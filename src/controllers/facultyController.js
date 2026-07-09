const { Faculty, Department, User } = require("../models");

// ── Helpers ───────────────────────────────────────────────────────────────────

const toSlug = (str) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ── Faculty handlers ──────────────────────────────────────────────────────────

/**
 * GET /faculties
 * Query: ?active=true  ?include=departments
 */
const getAllFaculties = async (req, res, next) => {
  try {
    const { active, include } = req.query;
    const includeDepts = include === "departments";

    const where = {};
    if (active === "true") where.isActive = true;

    const options = {
      where,
      order: [
        ["order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: ["id", "name", "icon", "description", "isActive", "order"],
    };

    if (includeDepts) {
      options.include = [
        {
          model: Department,
          as: "departments",
          where: { isActive: true },
          required: false,
          attributes: ["id", "name", "slug", "isActive", "order"],
          order: [["order", "ASC"]],
        },
      ];
    }

    const faculties = await Faculty.findAll(options);

    res.status(200).json({
      success: true,
      data: { faculties },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /faculties/:id
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
        {
          model: Department,
          as: "departments",
          attributes: ["id", "name", "slug", "isActive", "order"],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!faculty) {
      return res.status(404).json({ success: false, message: "Faculty not found" });
    }

    res.status(200).json({ success: true, data: { faculty } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /faculties  (tutor or admin)
 */
const createFaculty = async (req, res, next) => {
  try {
    const { name, icon, description, order } = req.body;
    const userId = req.user.id;

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
      order: order ?? 0,
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
 * PUT /faculties/:id  (admin only)
 */
const updateFaculty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, icon, description, isActive, order } = req.body;

    const faculty = await Faculty.findByPk(id);
    if (!faculty) {
      return res.status(404).json({ success: false, message: "Faculty not found" });
    }

    if (name && name !== faculty.name) {
      const conflict = await Faculty.findOne({ where: { name } });
      if (conflict) {
        return res.status(400).json({
          success: false,
          message: "Faculty with this name already exists",
        });
      }
    }

    await faculty.update({
      name: name || faculty.name,
      icon: icon !== undefined ? icon : faculty.icon,
      description: description !== undefined ? description : faculty.description,
      isActive: isActive !== undefined ? isActive : faculty.isActive,
      order: order !== undefined ? order : faculty.order,
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
 * DELETE /faculties/:id  (admin only — soft delete)
 */
const deleteFaculty = async (req, res, next) => {
  try {
    const { id } = req.params;

    const faculty = await Faculty.findByPk(id);
    if (!faculty) {
      return res.status(404).json({ success: false, message: "Faculty not found" });
    }

    await faculty.update({ isActive: false });

    res.status(200).json({ success: true, message: "Faculty deactivated successfully" });
  } catch (error) {
    next(error);
  }
};

// ── Department handlers ───────────────────────────────────────────────────────

/**
 * GET /faculties/:id/departments
 */
const getDepartments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { active } = req.query;

    const faculty = await Faculty.findByPk(id);
    if (!faculty) {
      return res.status(404).json({ success: false, message: "Faculty not found" });
    }

    const where = { facultyId: id };
    if (active === "true") where.isActive = true;

    const departments = await Department.findAll({
      where,
      order: [
        ["order", "ASC"],
        ["name", "ASC"],
      ],
      attributes: ["id", "name", "slug", "isActive", "order", "facultyId"],
    });

    res.status(200).json({ success: true, data: { departments } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /faculties/:id/departments  (admin only)
 */
const createDepartment = async (req, res, next) => {
  try {
    const { id: facultyId } = req.params;
    const { name, order } = req.body;

    const faculty = await Faculty.findByPk(facultyId);
    if (!faculty) {
      return res.status(404).json({ success: false, message: "Faculty not found" });
    }

    // Case-insensitive duplicate check within this faculty
    const existing = await Department.findOne({
      where: { facultyId, name },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Department with this name already exists in this faculty",
      });
    }

    const department = await Department.create({
      facultyId,
      name,
      slug: toSlug(name),
      order: order ?? 0,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: { department },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /departments/:id  (admin only)
 */
const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, isActive, order } = req.body;

    const dept = await Department.findByPk(id);
    if (!dept) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    await dept.update({
      name: name || dept.name,
      slug: name ? toSlug(name) : dept.slug,
      isActive: isActive !== undefined ? isActive : dept.isActive,
      order: order !== undefined ? order : dept.order,
    });

    res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: { department: dept },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /departments/:id  (admin only — soft delete)
 */
const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const dept = await Department.findByPk(id);
    if (!dept) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    await dept.update({ isActive: false });

    res.status(200).json({ success: true, message: "Department deactivated successfully" });
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
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
