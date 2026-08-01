const { User } = require("../models");

const getPreferences = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["notificationPrefs", "privacyPrefs"],
    });
    res.json({
      success: true,
      data: {
        notificationPrefs: user.notificationPrefs || null,
        privacyPrefs: user.privacyPrefs || null,
      },
    });
  } catch (err) {
    console.error("getPreferences error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const updatePreferences = async (req, res) => {
  try {
    const { type, prefs } = req.body;
    if (!type || !prefs || typeof prefs !== "object") {
      return res.status(400).json({ success: false, message: "type and prefs are required" });
    }
    if (!["notification", "privacy"].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be 'notification' or 'privacy'" });
    }

    const field = type === "notification" ? "notificationPrefs" : "privacyPrefs";
    await User.update({ [field]: prefs }, { where: { id: req.user.id } });

    res.json({ success: true, message: "Preferences saved" });
  } catch (err) {
    console.error("updatePreferences error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getPreferences, updatePreferences };
