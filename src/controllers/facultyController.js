const { Faculty, User } = require("../models");

/**
 * Get all faculties
 */
const getAllFaculties = async (req, res, next) => {
  try {
    const { active } = req.query;

    const where = {};
    if (active === "true") {
      where.isActive = true;
    }

    const faculties = await Faculty.findAll({
      where,
      order: [["name", "ASC"]],
      attributes: ["id", "name", "icon", "description", "isActive"],
    });

    res.status(200).json({
      success: true,
      data: { faculties },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get faculty by ID
 */
const getFacultyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const faculty = await Faculty.findByPk(id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { faculty },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new faculty (Tutor or Admin)
 */
const createFaculty = async (req, res, next) => {
  try {
    const { name, icon, description } = req.body;
    const userId = req.user.id;

    // Check if faculty name already exists
    const existingFaculty = await Faculty.findOne({ where: { name } });
    if (existingFaculty) {
      return res.status(400).json({
        success: false,
        message: "Faculty with this name already exists",
      });
    }

    const faculty = await Faculty.create({
      name,
      icon: icon || "🎓",
      description,
      createdBy: userId,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Faculty created successfully",
      data: { faculty },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update faculty (Admin only)
 */
const updateFaculty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, icon, description, isActive } = req.body;

    const faculty = await Faculty.findByPk(id);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
      });
    }

    // Check if new name conflicts with existing faculty
    if (name && name !== faculty.name) {
      const existingFaculty = await Faculty.findOne({ where: { name } });
      if (existingFaculty) {
        return res.status(400).json({
          success: false,
          message: "Faculty with this name already exists",
        });
      }
    }

    await faculty.update({
      name: name || faculty.name,
      icon: icon || faculty.icon,
      description:
        description !== undefined ? description : faculty.description,
      isActive: isActive !== undefined ? isActive : faculty.isActive,
    });

    res.status(200).json({
      success: true,
      message: "Faculty updated successfully",
      data: { faculty },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete faculty (Admin only)
 */
const deleteFaculty = async (req, res, next) => {
  try {
    const { id } = req.params;

    const faculty = await Faculty.findByPk(id);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty not found",
      });
    }

    // Soft delete - just mark as inactive
    await faculty.update({ isActive: false });

    res.status(200).json({
      success: true,
      message: "Faculty deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllFaculties,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
};
