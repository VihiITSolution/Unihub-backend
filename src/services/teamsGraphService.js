const axios = require("axios");

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
let tokenCache = { value: null, expiresAt: 0 };

const configured = () => Boolean(
  process.env.TEAMS_TENANT_ID && process.env.TEAMS_CLIENT_ID && process.env.TEAMS_CLIENT_SECRET,
);

const safeError = (error) => {
  const status = error.response?.status;
  const code = error.response?.data?.error?.code;
  const message = error.response?.data?.error?.message || error.message || "Microsoft Graph request failed";
  return [status, code, message].filter(Boolean).join(" ").slice(0, 500);
};

async function getAccessToken() {
  if (!configured()) throw new Error("Microsoft Teams integration is not configured");
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;

  const body = new URLSearchParams({
    client_id: process.env.TEAMS_CLIENT_ID,
    client_secret: process.env.TEAMS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await axios.post(
    `https://login.microsoftonline.com/${encodeURIComponent(process.env.TEAMS_TENANT_ID)}/oauth2/v2.0/token`,
    body.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 20_000 },
  );
  tokenCache = {
    value: response.data.access_token,
    expiresAt: Date.now() + (Number(response.data.expires_in || 3600) * 1000),
  };
  return tokenCache.value;
}

async function request(config, attempt = 0) {
  try {
    const token = await getAccessToken();
    return await axios({
      baseURL: GRAPH_ROOT,
      timeout: 30_000,
      ...config,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(config.headers || {}) },
    });
  } catch (error) {
    const status = error.response?.status;
    if (status === 401 && attempt === 0) tokenCache = { value: null, expiresAt: 0 };
    if ((status === 401 || status === 429 || status >= 500) && attempt < 3) {
      const retryAfter = Number(error.response?.headers?.["retry-after"] || 0);
      const waitMs = Math.min(30_000, Math.max(retryAfter * 1000, 500 * (2 ** attempt)));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return request(config, attempt + 1);
    }
    error.safeMessage = safeError(error);
    throw error;
  }
}

const userPath = (userIdOrEmail) => `/users/${encodeURIComponent(userIdOrEmail)}`;

// Graph pages most collections. Follow @odata.nextLink so a session with more
// attendees than one page still yields a complete attendance roster. nextLink is
// an absolute URL, which axios uses in place of baseURL.
async function collectAll(url, pageLimit = 50) {
  const items = [];
  let next = url;
  for (let page = 0; next && page < pageLimit; page += 1) {
    const response = await request({ method: "get", url: next });
    items.push(...(response.data.value || []));
    next = response.data["@odata.nextLink"] || null;
  }
  return items;
}

async function inviteGuest(email, displayName, redirectUrl) {
  const response = await request({
    method: "post",
    url: "/invitations",
    data: {
      invitedUserEmailAddress: email,
      invitedUserDisplayName: displayName,
      inviteRedirectUrl: redirectUrl || process.env.TEAMS_INVITE_REDIRECT_URL || "https://teams.microsoft.com/",
      sendInvitationMessage: true,
    },
  });
  return response.data;
}

async function getGuest(userId) {
  const response = await request({
    method: "get",
    url: `${userPath(userId)}?$select=id,mail,userPrincipalName,externalUserState`,
  });
  return response.data;
}

async function getOrganizer(userIdOrEmail) {
  const response = await request({ method: "get", url: `${userPath(userIdOrEmail)}?$select=id,mail,userPrincipalName` });
  return response.data;
}

const graphDateTime = (value) => new Date(value).toISOString().replace("Z", "");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
));

// The calendar event carries the join link in its body rather than asking
// Exchange to mint a Teams meeting via isOnlineMeeting. See createOnlineMeeting.
const eventBody = (session, joinUrl) => ({
  contentType: "HTML",
  content: [
    `<p>${escapeHtml(session.description || "UniHub live learning session")}</p>`,
    joinUrl ? `<p><a href="${escapeHtml(joinUrl)}">Join the Microsoft Teams meeting</a></p>` : "",
  ].join(""),
});

const eventAttendees = (attendees) => attendees.map((item) => ({
  emailAddress: { address: item.email, name: item.name || item.email },
  type: "required",
}));

// Create the Teams meeting directly instead of setting isOnlineMeeting on the
// calendar event. Event-driven creation depends on the organizer's Teams
// meeting policy (notably the Outlook add-in setting) and on the mailbox having
// been used interactively; when either is unmet Graph still returns 201 but
// with onlineMeeting null and onlineMeetingProvider "unknown", leaving no join
// URL. The onlineMeetings endpoint is the app-only path and is deterministic:
// it is covered by OnlineMeetings.ReadWrite.All plus the Teams application
// access policy that already scopes this app to the organizer.
async function createOnlineMeeting(organizer, session) {
  const response = await request({
    method: "post",
    url: `${userPath(organizer)}/onlineMeetings`,
    data: {
      subject: `[UniHub #${session.id}] ${session.title}`,
      startDateTime: new Date(session.scheduledStartTime).toISOString(),
      endDateTime: new Date(session.scheduledEndTime).toISOString(),
      allowedPresenters: "roleIsPresenter",
      recordAutomatically: Boolean(session.allowRecording),
    },
  });
  return response.data;
}

async function getOnlineMeeting(organizer, meetingId) {
  const response = await request({
    method: "get",
    url: `${userPath(organizer)}/onlineMeetings/${encodeURIComponent(meetingId)}`,
  });
  return response.data;
}

async function createCalendarMeeting(organizer, session, attendees, joinUrl) {
  const response = await request({
    method: "post",
    url: `${userPath(organizer)}/events`,
    headers: { Prefer: 'outlook.timezone="UTC"' },
    data: {
      subject: `[UniHub #${session.id}] ${session.title}`,
      body: eventBody(session, joinUrl),
      start: { dateTime: graphDateTime(session.scheduledStartTime), timeZone: "UTC" },
      end: { dateTime: graphDateTime(session.scheduledEndTime), timeZone: "UTC" },
      attendees: eventAttendees(attendees),
      location: joinUrl ? { displayName: "Microsoft Teams Meeting" } : undefined,
      allowNewTimeProposals: false,
      transactionId: `unihub-live-session-${session.id}`,
    },
  });
  return response.data;
}

async function getCalendarEvent(organizer, eventId) {
  const response = await request({ method: "get", url: `${userPath(organizer)}/events/${encodeURIComponent(eventId)}` });
  return response.data;
}

async function updateCalendarMeeting(organizer, eventId, session, attendees, joinUrl) {
  await request({
    method: "patch",
    url: `${userPath(organizer)}/events/${encodeURIComponent(eventId)}`,
    data: {
      subject: `[UniHub #${session.id}] ${session.title}`,
      body: eventBody(session, joinUrl),
      start: { dateTime: graphDateTime(session.scheduledStartTime), timeZone: "UTC" },
      end: { dateTime: graphDateTime(session.scheduledEndTime), timeZone: "UTC" },
      attendees: eventAttendees(attendees),
    },
  });
}

async function cancelCalendarMeeting(organizer, eventId) {
  await request({ method: "delete", url: `${userPath(organizer)}/events/${encodeURIComponent(eventId)}` });
}

async function findOnlineMeeting(organizer, joinUrl) {
  const response = await request({
    method: "get",
    url: `${userPath(organizer)}/onlineMeetings`,
    params: { "$filter": `JoinWebUrl eq '${String(joinUrl).replaceAll("'", "''")}'` },
  });
  return response.data.value?.[0] || null;
}

const meetingParticipant = (person) => ({
  upn: person.email,
  identity: person.entraGuestId
    ? { user: { id: person.entraGuestId, displayName: person.name, tenantId: process.env.TEAMS_TENANT_ID } }
    : undefined,
  role: person.presenter ? "presenter" : "attendee",
});

// `attendees` is the full roster: the tutor as presenter, then every enrolled
// student. The roster is what drives lobby bypass below, so it must be
// re-applied whenever enrolment changes.
async function configureOnlineMeeting(organizer, meetingId, attendees, allowRecording) {
  const roster = (Array.isArray(attendees) ? attendees : [attendees]).filter((item) => item?.email);
  const response = await request({
    method: "patch",
    url: `${userPath(organizer)}/onlineMeetings/${encodeURIComponent(meetingId)}`,
    // Opts into lobbyBypassScope members outside the default enum, so a
    // tightened TEAMS_LOBBY_BYPASS_SCOPE such as "invited" is accepted.
    headers: { Prefer: "include-unknown-enum-members" },
    data: {
      allowedPresenters: "roleIsPresenter",
      allowAttendeeToEnableMic: true,
      allowAttendeeToEnableCamera: true,
      recordAutomatically: Boolean(allowRecording),
      // Nobody signs in as the organizer: it is an unattended service mailbox
      // holding the single Business Basic licence. Teams will not start a
      // meeting, or admit anyone from the lobby, until someone with organizer
      // rights is present, and a B2B guest cannot be made co-organizer
      // ("External participants can't be made co-organizers"). Anything other
      // than "everyone" therefore deadlocks: the tutor sits in the lobby
      // alongside the students with nobody able to let them in.
      //
      // Access control lives in UniHub instead of the Teams lobby. The join
      // URL is the capability, and joinSession() releases it only to a student
      // with a completed enrolment and a redeemed invitation. The trade-off is
      // that a forwarded link admits its holder without a lobby check.
      lobbyBypassSettings: {
        scope: process.env.TEAMS_LOBBY_BYPASS_SCOPE || "everyone",
        isDialInBypassEnabled: false,
      },
      participants: { attendees: roster.map(meetingParticipant) },
    },
  });
  return response.data;
}

async function listAttendanceReports(organizer, meetingId) {
  const base = `${userPath(organizer)}/onlineMeetings/${encodeURIComponent(meetingId)}/attendanceReports`;
  const reports = await collectAll(base);
  const records = [];
  for (const report of reports) {
    records.push(...await collectAll(`${base}/${encodeURIComponent(report.id)}/attendanceRecords`));
  }
  return records;
}

async function listRecordings(organizer, meetingId) {
  return collectAll(`${userPath(organizer)}/onlineMeetings/${encodeURIComponent(meetingId)}/recordings`);
}

async function searchOrganizerDrive(organizer, query) {
  // Inside an OData string literal a single quote is escaped by doubling it.
  // encodeURIComponent does not touch quotes, so double them first.
  const literal = encodeURIComponent(String(query).replaceAll("'", "''"));
  return collectAll(`${userPath(organizer)}/drive/root/search(q='${literal}')`);
}

async function shareDriveItem(organizer, itemId, emails) {
  if (!emails.length) return;
  await request({
    method: "post",
    url: `${userPath(organizer)}/drive/items/${encodeURIComponent(itemId)}/invite`,
    data: { recipients: emails.map((email) => ({ email })), roles: ["read"], requireSignIn: true, sendInvitation: true },
  });
}

async function deleteDriveItem(organizer, itemId) {
  await request({ method: "delete", url: `${userPath(organizer)}/drive/items/${encodeURIComponent(itemId)}` });
}

async function getDriveQuota(organizer) {
  const response = await request({ method: "get", url: `${userPath(organizer)}/drive?$select=quota` });
  return response.data.quota || null;
}

module.exports = {
  configured, safeError, getAccessToken, inviteGuest, getGuest, getOrganizer, createCalendarMeeting,
  createOnlineMeeting, getOnlineMeeting,
  getCalendarEvent, updateCalendarMeeting, cancelCalendarMeeting, findOnlineMeeting,
  configureOnlineMeeting, listAttendanceReports, listRecordings, searchOrganizerDrive,
  shareDriveItem, deleteDriveItem, getDriveQuota,
};
