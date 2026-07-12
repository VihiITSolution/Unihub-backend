const { SupportTicket } = require("../models");

const createTicket = async (req, res, next) => {
  try {
    const { subject, category, priority, description } = req.body;
    const attachments = (req.files || []).map((file) => file.path);

    const ticket = await SupportTicket.create({
      userId: req.user.id,
      subject,
      category,
      priority: priority || "medium",
      description,
      attachments,
    });

    res.status(201).json({
      success: true,
      message: "Ticket submitted successfully. Our team will get back to you soon.",
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
};

const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.findAll({
      where: { userId: req.user.id },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: { tickets },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createTicket, getMyTickets };
