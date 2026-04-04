/**
 * Exam Events Routes
 * Tracks student actions during exams (tab switching, page refresh, time per question, etc.)
 */

import express from 'express';
import { pool } from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

/**
 * Helper: Extract user info from session OR JWT token
 * Checks both authentication methods
 */
const getUserFromRequest = (req) => {
  let userId = null;
  let userRole = null;

  // Try session first
  if (req.session?.userId) {
    userId = req.session.userId;
    userRole = req.session.role;
  }
  // Try JWT token if no session
  else if (req.headers.authorization) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
        userId = decoded.id;
        userRole = decoded.role;
      }
    } catch (error) {
      // JWT verification failed, no user found
    }
  }

  return { userId, userRole };
};

/**
 * PROFESSOR/ADMIN VIEWS
 * Get all submissions with suspicious activity for an exam
 * GET /api/submissions/exam/:examId
 * Shows list of all student submissions with activity summary
 */
router.get('/exam/:examId', async (req, res) => {
  const { examId } = req.params;
  const { userId, userRole } = getUserFromRequest(req);

  // ✅ SECURE: Check if user is authenticated
  if (!userId || !userRole) {
    console.log('[🚫 UNAUTHENTICATED] No session or JWT found - user must login first');
    return res.status(401).json({ error: 'Not authenticated - please login first' });
  }

  try {
    // Verify user is admin or professor who created this exam
    const [examData] = await pool.execute(
      `SELECT id, title, professor_id FROM exams WHERE id = ?`,
      [examId]
    );

    if (!examData.length) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const exam = examData[0];
    const isAdmin = userRole === 'admin';
    const isProfessor = userRole === 'professor' && parseInt(exam.professor_id) === parseInt(userId);

    if (!isAdmin && !isProfessor) {
      console.log(`[🚫 UNAUTHORIZED] User ${userId} (${userRole}) tried to view exam ${examId} events`);
      return res.status(403).json({ error: 'Unauthorized - only professors and admins can view exam events' });
    }

    // Get all submissions for this exam with event counts
    const [submissions] = await pool.execute(
      `SELECT 
        s.id as submission_id,
        s.exam_id,
        s.student_id,
        u.username as student_name,
        u.email as student_email,
        s.submitted_at,
        s.is_submitted,
        COUNT(ee.id) as total_events,
        SUM(CASE WHEN ee.event_type = 'tab_switched' THEN 1 ELSE 0 END) as tab_switches,
        SUM(CASE WHEN ee.event_type = 'page_refreshed' THEN 1 ELSE 0 END) as page_refreshes,
        SUM(CASE WHEN ee.event_type = 'answer_saved' THEN 1 ELSE 0 END) as answers_saved,
        CASE 
          WHEN SUM(CASE WHEN ee.event_type = 'tab_switched' THEN 1 ELSE 0 END) > 5 
               OR SUM(CASE WHEN ee.event_type = 'page_refreshed' THEN 1 ELSE 0 END) > 2
          THEN 'HIGH'
          ELSE 'LOW'
        END as suspicious_level
       FROM submissions s
       JOIN users u ON s.student_id = u.id
       LEFT JOIN exam_events ee ON s.id = ee.submission_id
       WHERE s.exam_id = ?
       GROUP BY s.id
       ORDER BY suspicious_level DESC, tab_switches DESC`,
      [examId]
    );

    console.log(`[✅ EXAM EVENTS VIEWED] User ${userId} (${userRole}) viewed ${submissions.length} submissions for exam ${exam.title}`);

    res.json({
      examId,
      examTitle: exam.title,
      viewedBy: `${userRole} (ID: ${userId})`,
      totalSubmissions: submissions.length,
      highSuspicion: submissions.filter(s => s.suspicious_level === 'HIGH').length,
      submissions: submissions
    });
  } catch (error) {
    console.error('[❌ EXAM EVENTS ERROR]', error.message);
    res.status(500).json({ error: 'Failed to fetch exam events', details: error.message });
  }
});

/**
 * Log an exam event
 * POST /api/submissions/:submissionId/events
 */
router.post('/:submissionId/events', async (req, res) => {
  const { submissionId } = req.params;
  const { event_type, event_details, question_id, time_spent_seconds, student_id, exam_id } = req.body;

  if (!event_type || !student_id || !exam_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const validEventTypes = ['exam_started', 'question_viewed', 'answer_saved', 'tab_switched', 'page_refreshed', 'exam_submitted'];
  if (!validEventTypes.includes(event_type)) {
    return res.status(400).json({ error: 'Invalid event type' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO exam_events 
       (submission_id, student_id, exam_id, event_type, event_details, question_id, time_spent_seconds) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [submissionId, student_id, exam_id, event_type, event_details ? JSON.stringify(event_details) : null, question_id || null, time_spent_seconds || null]
    );
    res.json({ eventId: result.insertId, message: 'Event logged successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log event', details: error.message });
  }
});

/**
 * Get all events for a submission
 */
router.get('/:submissionId/events', async (req, res) => {
  const { submissionId } = req.params;
  const { userId, userRole } = getUserFromRequest(req);

  if (!userId || !userRole) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const [submissionData] = await pool.execute(
      `SELECT s.id, s.exam_id, e.professor_id, u.id as student_id, u.username as student_name
       FROM submissions s
       JOIN exams e ON s.exam_id = e.id
       JOIN users u ON s.student_id = u.id
       WHERE s.id = ?`,
      [submissionId]
    );

    if (!submissionData.length) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = submissionData[0];
    const isAdmin = userRole === 'admin';
    const isProfessor = userRole === 'professor' && parseInt(submission.professor_id) === parseInt(userId);

    if (!isAdmin && !isProfessor) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [events] = await pool.execute(
      `SELECT id, event_type, event_details, question_id, time_spent_seconds, timestamp
       FROM exam_events WHERE submission_id = ? ORDER BY timestamp ASC`,
      [submissionId]
    );

    res.json({
      submissionId,
      studentName: submission.student_name,
      events: events.map(e => ({ ...e, event_details: e.event_details ? JSON.parse(e.event_details) : null }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get event summary
 */
router.get('/:submissionId/events/summary', async (req, res) => {
  const { submissionId } = req.params;
  const { userId, userRole } = getUserFromRequest(req);

  if (!userId || !userRole) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const [submissionData] = await pool.execute(
      `SELECT s.id, s.exam_id, e.professor_id, u.id as student_id, u.username as student_name
       FROM submissions s
       JOIN exams e ON s.exam_id = e.id
       JOIN users u ON s.student_id = u.id
       WHERE s.id = ?`,
      [submissionId]
    );

    if (!submissionData.length) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = submissionData[0];
    const isAdmin = userRole === 'admin';
    const isProfessor = userRole === 'professor' && parseInt(submission.professor_id) === parseInt(userId);

    if (!isAdmin && !isProfessor) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [results] = await pool.execute(
      `SELECT event_type, COUNT(*) as count, 
       SUM(CASE WHEN time_spent_seconds IS NOT NULL THEN time_spent_seconds ELSE 0 END) as total_time_seconds
       FROM exam_events WHERE submission_id = ? GROUP BY event_type`,
      [submissionId]
    );

    const tabSwitches = results.find(r => r.event_type === 'tab_switched')?.count || 0;
    const pageRefreshes = results.find(r => r.event_type === 'page_refreshed')?.count || 0;
    const suspiciousLevel = tabSwitches > 3 || pageRefreshes > 2 ? 'HIGH' : 'LOW';

    res.json({
      submissionId,
      studentName: submission.student_name,
      summary: results,
      suspiciousActivity: {
        tabSwitches,
        pageRefreshes,
        suspicionLevel: suspiciousLevel,
        recommendation: suspiciousLevel === 'HIGH' ? 'Consider reviewing this submission' : 'Normal activity'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Log AI Extension Detection Event
 */
router.post('/ai-detection', async (req, res) => {
  try {
    const { type, data, userAgent, student_id, exam_id } = req.body;

    if (!type || !student_id || !exam_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [submissions] = await pool.execute(
      `SELECT id FROM submissions WHERE student_id = ? AND exam_id = ? ORDER BY id DESC LIMIT 1`,
      [student_id, exam_id]
    );

    if (submissions.length === 0) {
      return res.status(400).json({ error: 'No submission found' });
    }

    const submission_id = submissions[0].id;
    const eventDetails = { type, ...data, userAgent };

    await pool.execute(
      `INSERT INTO exam_events (submission_id, student_id, exam_id, event_type, event_details) 
       VALUES (?, ?, ?, ?, ?)`,
      [submission_id, student_id, exam_id, 'ai_detection', JSON.stringify(eventDetails)]
    );

    // ✅ If this was a terminal strike, send the security alert email
    if (req.body.isFinalStrike) {
      try {
        const [userData] = await pool.execute('SELECT username, email FROM users WHERE id = ?', [student_id]);
        const [examData] = await pool.execute('SELECT title FROM exams WHERE id = ?', [exam_id]);
        
        if (userData.length > 0 && examData.length > 0) {
          const { sendAutoSubmissionEmail } = await import('../services/emailService.js');
          await sendAutoSubmissionEmail(
            userData[0].email,
            userData[0].username,
            examData[0].title,
            req.body.allEvents || [] // Send the list of events as the reason
          );
        }
      } catch (emailErr) {
        console.error('[⚠️ AUTO-SUBMIT EMAIL] Failed:', emailErr.message);
      }
    }

    res.json({ success: true, message: 'AI detection event stored' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log AI detection event' });
  }
});

export default router;
