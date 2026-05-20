import express from "express";
import jwt from "jsonwebtoken";

import { pool } from "../db";
import { verifyGoogleToken } from "../services/google";

const router = express.Router();

router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;

    const payload = await verifyGoogleToken(token);

    if (!payload?.email) {
      return res.status(401).json({
        message: "Invalid Google token",
      });
    }

    const existingUser = await pool.query(
      `
      SELECT * FROM users
      WHERE email = $1
      `,
      [payload.email]
    );

    let user = existingUser.rows[0];

    if (!user) {
      const createdUser = await pool.query(
        `
        INSERT INTO users (
          email,
          first_name,
          last_name,
          profile_image_url,
          google_id
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          payload.email,
          payload.given_name,
          payload.family_name,
          payload.picture,
          payload.sub,
        ]
      );

      user = createdUser.rows[0];
    }

    const accessToken = jwt.sign(
      {
        userId: user.id,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      accessToken,
      user,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Google auth failed",
    });
  }
});

export default router;