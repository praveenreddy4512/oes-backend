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
      const token = req.headers.authorization.split(' ')[1]; // Get token after "Bearer "
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
      userId = decoded.id;
      userRole = decoded.role;
    } catch (error) {
      // JWT verification failed, no user found
    }
  }

  return { userId, userRole };
};

/**
 * Log an exam event
 * POST /api/submissions/:submissionId/events
 * 
 * Body:
 * {
 *   "event_type": "tab_switched|page_refreshed|question_viewed|answer_saved|exam_started|exam_submitted",
 *   "event_details": { optional JSON object with event data },
 *   "question_id": optional question ID,
 *   "time_spent_seconds": optional time spent on current question,
 *   "student_id": student ID,
 *   "exam_id": exam ID
 * }
 */
router.post('/:submissionId/events', async (req, res) => {
  const { submissionId } = req.params;
  const { event_type, event_details, question_id, time_spent_seconds, student_id, exam_id } = req.body;

  // ✅ SECURE: Validate required fields
  if (!event_type || !student_id || !exam_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // ✅ SECURE: Validate event type
  const validEventTypes = [
    'exam_started',
    'question_viewed',
    'answer_saved',
    'tab_switched',
    'page_refreshed',
    'exam_submitted'
  ];
  
  if (!validEventTypes.includes(event_type)) {
    return res.status(400).json({ error: 'Invalid event type' });
  }

  try {
    // Insert event into database
    const [result] = await pool.execute(
      `INSERT INTO exam_events 
       (submission_id, student_id, exam_id, event_type, event_details, question_id, time_spent_seconds) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        submissionId,
        student_id,
        exam_id,
        event_type,
        event_details ? JSON.stringify(event_details) : null,
        question_id || null,
        time_spent_seconds || null
      ]
    );

    console.log(`[📊 EVENT LOGGED] Type: ${event_type}, Student: ${student_id}, Submission: ${submissionId}`);

    res.json({
      eventId: result.insertId,
      message: 'Event logged successfully',
      event: {
        type: event_type,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[❌ EVENT LOGGING ERROR]', error.message);
    res.status(500).json({ error: 'Failed to log event', details: error.message });
  }
});

/**
 * Get all events for a submission (Professor/Admin only)
 * GET /api/submissions/:submissionId/events
 * Requires: User must be admin OR professor who created the exam
 */
router.get('/:submissionId/events', async (req, res) => {
  const { submissionId } = req.params;
  const { userId, userRole } = getUserFromRequest(req);

  // ✅ SECURE: Check if user is authenticated
  if (!userId || !userRole) {
    console.log('[🚫 UNAUTHENTICATED] No session or JWT found - user must login first');
    return res.status(401).json({ error: 'Not authenticated - please login first' });
  }

  try {
    // Get submission details and exam info
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

    // ✅ SECURE: Check authorization - only admin or professor who created exam can view
    const isAdmin = userRole === 'admin';
    const isProfessor = userRole === 'professor' && submission.professor_id === userId;
    
    if (!isAdmin && !isProfessor) {
      console.log(`[🚫 UNAUTHORIZED] User ${userId} (${userRole}) tried to view events for submission ${submissionId}`);
      return res.status(403).json({ error: 'Unauthorized - only professors and admins can view student events' });
    }

    // Fetch all events for this submission
    const [events] = await pool.execute(
      `SELECT 
        id,
        event_type,
        event_details,
        question_id,
        time_spent_seconds,
        timestamp
       FROM exam_events
       WHERE submission_id = ?
       ORDER BY timestamp ASC`,
      [submissionId]
    );

    // Parse JSON details
    const parsedEvents = events.map(event => ({
      ...event,
      event_details: event.event_details ? JSON.parse(event.event_details) : null
    }));

    console.log(`[✅ EVENTS VIEWED] User ${userId} (${userRole}) viewed ${parsedEvents.length} events for student ${submission.student_name}`);

    res.json({
      submissionId,
      studentName: submission.student_name,
      studentId: submission.student_id,
      examId: submission.exam_id,
      totalEvents: parsedEvents.length,
      viewedBy: `${userRole} (ID: ${userId})`,
      events: parsedEvents
    });
  } catch (error) {
    console.error('[❌ GET EVENTS ERROR]', error.message);
    res.status(500).json({ error: 'Failed to fetch events', details: error.message });
  }
});

/**
 * Get event summary statistics for a submission (Professor/Admin only)
 * GET /api/submissions/:submissionId/events/summary
 * Shows: tab switches, page refreshes, time per question, suspicious activity
 */
router.get('/:submissionId/events/summary', async (req, res) => {
  const { submissionId } = req.params;
  const { userId, userRole } = getUserFromRequest(req);

  // ✅ SECURE: Check if user is authenticated
  if (!userId || !userRole) {
    console.log('[🚫 UNAUTHENTICATED] No session or JWT found - user must login first');
    return res.status(401).json({ error: 'Not authenticated - please login first' });
  }

  try {
    // Get submission details and exam info
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

    // ✅ SECURE: Check authorization
    const isAdmin = userRole === 'admin';
    const isProfessor = userRole === 'professor' && submission.professor_id === userId;
    
    if (!isAdmin && !isProfessor) {
      console.log(`[🚫 UNAUTHORIZED] User ${userId} (${userRole}) tried to view summary for submission ${submissionId}`);
      return res.status(403).json({ error: 'Unauthorized - only professors and admins can view student events' });
    }

    const [results] = await pool.execute(
      `SELECT 
        event_type,
        COUNT(*) as count,
        SUM(CASE WHEN time_spent_seconds IS NOT NULL THEN time_spent_seconds ELSE 0 END) as total_time_seconds,
        MIN(timestamp) as first_occurrence,
        MAX(timestamp) as last_occurrence
       FROM exam_events
       WHERE submission_id = ?
       GROUP BY event_type`,
      [submissionId]
    );

    // Calculate suspicious activity indicators
    const tabSwitches = results.find(r => r.event_type === 'tab_switched')?.count || 0;
    const pageRefreshes = results.find(r => r.event_type === 'page_refreshed')?.count || 0;
    const suspiciousLevel = tabSwitches > 3 || pageRefreshes > 2 ? 'HIGH' : 'LOW';

    console.log(`[✅ SUMMARY VIEWED] User ${userId} (${userRole}) viewed summary for student ${submission.student_name} - Suspicious: ${suspiciousLevel}`);

    res.json({
      submissionId,
      studentName: submission.student_name,
      studentId: submission.student_id,
      examId: submission.exam_id,
      viewedBy: `${userRole} (ID: ${userId})`,
      summary: results,
      suspiciousActivity: {
        tabSwitches,
        pageRefreshes,
        suspicionLevel: suspiciousLevel,
        recommendation: suspiciousLevel === 'HIGH' ? 'Consider reviewing this submission more carefully' : 'No suspicious activity detected'
      }
    });
  } catch (error) {
    console.error('[❌ SUMMARY ERROR]', error.message);
    res.status(500).json({ error: 'Failed to generate summary', details: error.message });
  }
});

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
    const isProfessor = userRole === 'professor' && exam.professor_id === userId;

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
          WHEN SUM(CASE WHEN ee.event_type = 'tab_switched' THEN 1 ELSE 0 END) > 3 
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
 * Log AI Extension Detection Event
 * POST /api/submissions/ai-detection
 * 
 * Logs when student attempts to use AI tools (Copilot, ChatGPT, etc)
 * 
 * Body:
 * {
 *   "type": "COPILOT_SHORTCUT_ATTEMPT|AI_API_REQUEST_BLOCKED|EXTENSION_MESSAGE_ATTEMPT|etc",
 *   "data": { event details },
 *   "userAgent": browser user agent,
 *   "timestamp": ISO timestamp,
 *   "student_id": student ID,
 *   "exam_id": exam ID
 * }
 */
router.post('/ai-detection', async (req, res) => {
  try {
    const { type, data, userAgent, timestamp, student_id, exam_id } = req.body;

    // ✅ SECURE: Validate required fields
    if (!type || !data || !student_id || !exam_id) {
      return res.status(400).json({ error: 'Missing required fields: type, data, student_id, exam_id' });
    }

    // Get current submission for this student+exam
    const [submissions] = await pool.execute(
      `SELECT id FROM submissions WHERE student_id = ? AND exam_id = ? ORDER BY id DESC LIMIT 1`,
      [student_id, exam_id]
    );

    if (submissions.length === 0) {
      return res.status(400).json({ error: 'No submission found for this student and exam' });
    }

    const submission_id = submissions[0].id;

    // ✅ Store AI detection event in database
    const eventDetails = {
      type: type,
      ...data,
      userAgent: userAgent
    };

    await pool.execute(
      `INSERT INTO exam_events 
       (submission_id, student_id, exam_id, event_type, event_details) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        submission_id,
        student_id,
        exam_id,
        'ai_detection',  // Event type for all AI detections
        JSON.stringify(eventDetails)
      ]
    );

    console.log(`[⚠️ AI DETECTION STORED] Type: ${type}, Student: ${student_id}, Exam: ${exam_id}`, JSON.stringify(data));

    res.json({ 
      success: true, 
      message: 'AI detection event stored',
      event: type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[❌ AI DETECTION LOG ERROR]', error.message);
    res.status(500).json({ error: 'Failed to log AI detection event' });
  }
});

export default router;
