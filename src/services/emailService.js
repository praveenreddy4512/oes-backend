/**
 * Email Service Module
 * Handles all email communications using SMTP
 * 
 * Configuration required in .env file:
 * - EMAIL_SERVICE (gmail, outlook, custom SMTP)
 * - EMAIL_USER (sender email address)
 * - EMAIL_PASSWORD (app password or email password)
 * - SMTP_HOST (for custom SMTP)
 * - SMTP_PORT (for custom SMTP)
 * - SMTP_SECURE (true/false for custom SMTP)
 * - FRONTEND_URL (for email links)
 */

import nodemailer from 'nodemailer';

// Store transporter instance for reuse
let emailTransporter = null;

/**
 * Initialize email transporter
 * Supports Gmail, Outlook, and custom SMTP servers
 */
export async function initializeEmailTransporter() {
  try {
    const emailService = process.env.EMAIL_SERVICE || 'gmail';
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;

    // Validate required environment variables
    if (!emailUser || !emailPassword) {
      console.warn('[⚠️ EMAIL] EMAIL_USER or EMAIL_PASSWORD not configured. Email features will not work.');
      console.warn('[⚠️ EMAIL] Configure SMTP settings in .env file to enable email notifications.');
      return null;
    }

    let transportConfig;

    if (emailService === 'gmail') {
      // ✅ Gmail configuration (requires App Password, not regular password)
      // https://support.google.com/accounts/answer/185833
      transportConfig = {
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPassword, // Use App Password for Gmail
        },
      };
    } else if (emailService === 'outlook') {
      // ✅ Outlook/Office365 configuration
      transportConfig = {
        service: 'outlook',
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      };
    } else {
      // ✅ Custom SMTP server configuration
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT || 587;
      const smtpSecure = process.env.SMTP_SECURE === 'true'; // Use TLS/SSL

      if (!smtpHost) {
        console.warn('[⚠️ EMAIL] Invalid EMAIL_SERVICE and SMTP_HOST not configured');
        return null;
      }

      transportConfig = {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure, // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      };
    }

    emailTransporter = nodemailer.createTransport(transportConfig);

    // Verify connection
    await emailTransporter.verify();
    console.log('[✅ EMAIL] SMTP connection verified successfully');
    return emailTransporter;
  } catch (error) {
    console.error('[❌ EMAIL] Failed to initialize email transporter:', error.message);
    emailTransporter = null;
    return null;
  }
}

/**
 * Send email using the configured transporter
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content of email
 * @param {string} [baseSubject] - Type for logging
 * @returns {Promise<boolean>} - true if sent successfully, false otherwise
 */
export async function sendEmail(to, subject, html, baseSubject = 'EMAIL') {
  try {
    // Check if transporter is initialized
    if (!emailTransporter) {
      console.warn(`[⚠️ ${baseSubject}] Email transporter not initialized. Skipping email to ${to}`);
      return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      console.warn(`[⚠️ ${baseSubject}] Invalid email address: ${to}`);
      return false;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      html: html,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log(`[✅ ${baseSubject}] Email sent to ${to}:`, info.messageId);
    return true;
  } catch (error) {
    console.error(`[❌ ${baseSubject}] Failed to send email to ${to}:`, error.message);
    return false;
  }
}

/**
 * Send exam submission success email to student
 * @param {string} studentEmail - Student email address
 * @param {string} studentName - Student name
 * @param {string} examTitle - Exam title
 * @param {number} score - Student's score
 * @param {number} totalMarks - Total possible marks
 * @param {number} percentage - Score percentage
 */
export async function sendSubmissionSuccessEmail(studentEmail, studentName, examTitle, score, totalMarks, percentage) {
  const subject = `Exam Submitted Successfully - ${examTitle}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #af0c3e; color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Exam Submitted</h1>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Dear <strong>${studentName}</strong>,</p>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 25px 0;">Your exam has been submitted successfully. Your results are shown below:</p>
        
        <div style="background-color: #f5f5f5; border-left: 4px solid #af0c3e; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Exam:</strong></td>
              <td style="padding: 8px 0; color: #333; text-align: right;"><strong>${examTitle}</strong></td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 8px 0; color: #666;"><strong>Score:</strong></td>
              <td style="padding: 8px 0; color: #af0c3e; text-align: right;"><strong>${score}/${totalMarks}</strong></td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 8px 0; color: #666;"><strong>Percentage:</strong></td>
              <td style="padding: 8px 0; color: #af0c3e; text-align: right;"><strong>${percentage}%</strong></td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 25px 0;">Your submission has been recorded. You can view detailed results and feedback in your exam portal.</p>
        
        <p style="font-size: 13px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; line-height: 1.6;">
          Online Examination System<br>
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(studentEmail, subject, html, 'SUBMIT_SUCCESS');
}

/**
 * Send exam not submitted notification email to student
 * @param {string} studentEmail - Student email address
 * @param {string} studentName - Student name
 * @param {string} examTitle - Exam title
 * @param {string} reason - Reason for non-submission (e.g., "Time ended", "Did not submit")
 */
export async function sendNonSubmissionEmail(studentEmail, studentName, examTitle, reason = 'Exam time ended') {
  const subject = `Exam Not Submitted - ${examTitle}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #af0c3e; color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Exam Not Submitted</h1>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Dear <strong>${studentName}</strong>,</p>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 25px 0;">We have recorded that you did not submit your exam. Below are the details:</p>
        
        <div style="background-color: #fff5f5; border-left: 4px solid #dc3545; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Exam:</strong></td>
              <td style="padding: 8px 0; color: #333; text-align: right;"><strong>${examTitle}</strong></td>
            </tr>
            <tr style="border-top: 1px solid #f0d0d0;">
              <td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td>
              <td style="padding: 8px 0; color: #dc3545; text-align: right;"><strong>Not Submitted</strong></td>
            </tr>
            <tr style="border-top: 1px solid #f0d0d0;">
              <td style="padding: 8px 0; color: #666;"><strong>Reason:</strong></td>
              <td style="padding: 8px 0; color: #333; text-align: right;"><strong>${reason}</strong></td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 25px 0;">If you believe this is an error or if you need assistance, please contact your instructor immediately.</p>
        
        <p style="font-size: 13px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; line-height: 1.6;">
          Online Examination System<br>
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(studentEmail, subject, html, 'SUBMIT_FAILED');
}

/**
 * Send exam completion statistics to professor
 * @param {string} professorEmail - Professor email address
 * @param {string} professorName - Professor name
 * @param {string} examTitle - Exam title
 * @param {number} totalStudents - Total students assigned to exam
 * @param {number} submittedCount - Number of students who submitted
 * @param {number} notSubmittedCount - Number of students who didn't submit
 * @param {number} averageScore - Average score (percentage)
 * @param {array} topScores - Top 3 scores (optional)
 */
export async function sendExamCompletionEmail(
  professorEmail,
  professorName,
  examTitle,
  totalStudents,
  submittedCount,
  notSubmittedCount,
  averageScore,
  topScores = []
) {
  const submissionRate = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;
  
  let topScoresHtml = '';
  if (topScores.length > 0) {
    topScoresHtml = `
      <h3 style="margin: 25px 0 15px 0; color: #333; font-weight: 600;">Top Performers</h3>
      <ol style="color: #555; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
        ${topScores.map((score) => `
          <li>${score.studentName}: ${score.percentage}% (${score.score}/${score.totalMarks})</li>
        `).join('')}
      </ol>
    `;
  }

  const subject = `Exam Completed - ${examTitle} - Results Summary`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #af0c3e; color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Exam Results Summary</h1>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333; margin: 0 0 25px 0;">Dear <strong>${professorName}</strong>,</p>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 25px 0;">Your exam <strong>"${examTitle}"</strong> has concluded. Here is a summary of submissions and results:</p>
        
        <div style="background-color: #f5f5f5; border-left: 4px solid #af0c3e; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
            <tr>
              <td style="padding: 10px 0; color: #666;"><strong>Total Students:</strong></td>
              <td style="padding: 10px 0; color: #333; text-align: right;"><strong>${totalStudents}</strong></td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 10px 0; color: #666;"><strong>Submitted:</strong></td>
              <td style="padding: 10px 0; color: #28a745; text-align: right;"><strong>${submittedCount}</strong></td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 10px 0; color: #666;"><strong>Not Submitted:</strong></td>
              <td style="padding: 10px 0; color: #dc3545; text-align: right;"><strong>${notSubmittedCount}</strong></td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 10px 0; color: #666;"><strong>Submission Rate:</strong></td>
              <td style="padding: 10px 0; color: #af0c3e; text-align: right;"><strong>${submissionRate}%</strong></td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 10px 0; color: #666;"><strong>Average Score:</strong></td>
              <td style="padding: 10px 0; color: #af0c3e; text-align: right;"><strong>${averageScore}%</strong></td>
            </tr>
          </table>
        </div>
        
        ${topScoresHtml}
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 25px 0;">Login to your instructor dashboard to view detailed analysis, student responses, and additional insights.</p>
        
        <p style="font-size: 13px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; line-height: 1.6;">
          Online Examination System<br>
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(professorEmail, subject, html, 'EXAM_COMPLETION');
}

/**
 * Send password reset email with reset link
 * @param {string} email - User email address
 * @param {string} userName - User name
 * @param {string} resetToken - Password reset token
 */
export async function sendPasswordResetEmail(email, userName, resetToken) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  const subject = 'Password Reset Request';
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #af0c3e; color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Password Reset Request</h1>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333; margin: 0 0 25px 0;">Hello <strong>${userName}</strong>,</p>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 25px 0;">We received a request to reset your password. Click the button below to proceed with resetting your password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="display: inline-block; background-color: #af0c3e; color: white; padding: 14px 40px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px;">
            Reset Password
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 30px 0;">Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 13px; color: #333; margin: 0;">
          ${resetLink}
        </p>
        
        <div style="background-color: #fff5f5; border-left: 4px solid #af0c3e; padding: 15px; margin: 25px 0; border-radius: 4px;">
          <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
            <strong>Security Notice:</strong> This link will expire in 1 hour. If you did not request a password reset, please contact support immediately and your account will remain secure.
          </p>
        </div>
        
        <p style="font-size: 13px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; line-height: 1.6;">
          Online Examination System<br>
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(email, subject, html, 'PASSWORD_RESET');
}

/**
 * Send password changed confirmation email
 * @param {string} email - User email address
 * @param {string} userName - User name
 */
/**
 * Send auto-submission notification due to security violations
 * @param {string} studentEmail - Student email address
 * @param {string} studentName - Student name
 * @param {string} examTitle - Exam title
 * @param {Array} violations - List of violation events
 */
export async function sendAutoSubmissionEmail(studentEmail, studentName, examTitle, violations = []) {
  const subject = `CRITICAL: Exam Terminated - Security Violation - ${examTitle}`;
  
  // Format violations for email
  const violationListHtml = violations.length > 0 
    ? `<ul style="color: #af0c3e; font-weight: 600; padding-left: 20px;">
        ${violations.slice(-5).map(v => `<li>${v.type.replace(/_/g, ' ')} at ${v.localTime || new Date(v.timestamp).toLocaleTimeString()}</li>`).join('')}
       </ul>`
    : 'Multiple security protocols were breached.';

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #af0c3e; color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700;">Security Breach Alert</h1>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Dear <strong>${studentName}</strong>,</p>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 25px 0;">Your exam session for <strong>${examTitle}</strong> was <strong>terminated and automatically submitted</strong> due to multiple security violations.</p>
        
        <div style="background-color: #fff5f5; border-left: 4px solid #af0c3e; padding: 20px; margin: 25px 0; border-radius: 8px;">
          <p style="margin: 0 0 10px 0; font-weight: 700; color: #af0c3e;">Violation Summary:</p>
          ${violationListHtml}
        </div>
        
        <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 25px 0;">The system detected activities that bypass the established exam integrity protocols. Your current progress has been locked and submitted to your instructor for mandatory review.</p>
        
        <p style="font-size: 13px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; line-height: 1.6;">
          Online Examination Security System<br>
          This is an automated security notification.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(studentEmail, subject, html, 'SECURITY_AUTO_SUBMIT');
}

export async function sendPasswordChangedEmail(email, userName) {
  const subject = 'Password Changed Successfully';
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #af0c3e; color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Password Updated</h1>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333; margin: 0 0 25px 0;">Hello <strong>${userName}</strong>,</p>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 25px 0;">Your password has been changed successfully. Your account is now secured with the new password.</p>
        
        <div style="background-color: #f0f0f0; border-left: 4px solid #28a745; padding: 15px; margin: 25px 0; border-radius: 4px;">
          <p style="margin: 0; color: #333; font-size: 15px; line-height: 1.6;">
            <strong>What happens next:</strong> You can now log in with your new password. If you did not make this change, please contact support immediately.
          </p>
        </div>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 25px 0;">For security, we recommend not sharing your password with anyone and keeping it secure.</p>
        
        <p style="font-size: 13px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; line-height: 1.6;">
          Online Examination System<br>
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(email, subject, html, 'PASSWORD_CHANGED');
}

/**
 * Send new exam notification email to students
 * @param {string} studentEmail - Student email address
 * @param {string} studentName - Student name
 * @param {string} examTitle - Exam title
 * @param {string} professorName - Professor name who created the exam
 * @param {string} startTime - Exam start time (format: YYYY-MM-DD HH:MM)
 * @param {string} endTime - Exam end time (format: YYYY-MM-DD HH:MM)
 * @param {number} durationMinutes - Exam duration in minutes
 */
export async function sendNewExamNotificationEmail(
  studentEmail,
  studentName,
  examTitle,
  professorName,
  startTime,
  endTime,
  durationMinutes
) {
  // Format times for display (remove milliseconds if present)
  const formatTime = (time) => {
    if (!time) return 'N/A';
    return String(time).replace(/\.\d{3}Z?$/, '').replace('Z', '');
  };
  
  const formattedStart = formatTime(startTime);
  const formattedEnd = formatTime(endTime);

  const subject = `📝 New Exam Created: ${examTitle}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #af0c3e; color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">📝 New Exam Added</h1>
      </div>
      
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Dear <strong>${studentName}</strong>,</p>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 25px 0;">A new exam has been added to your course. Please review the details below:</p>
        
        <div style="background-color: #f5f5f5; border-left: 4px solid #af0c3e; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
            <tr>
              <td style="padding: 10px 0; color: #666;"><strong>📋 Exam Title:</strong></td>
              <td style="padding: 10px 0; color: #333; text-align: right;"><strong>${examTitle}</strong></td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 10px 0; color: #666;"><strong>👨‍🏫 Created By:</strong></td>
              <td style="padding: 10px 0; color: #333; text-align: right;"><strong>${professorName}</strong></td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 10px 0; color: #666;"><strong>🕐 Start Time:</strong></td>
              <td style="padding: 10px 0; color: #af0c3e; text-align: right;"><strong>${formattedStart}</strong></td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 10px 0; color: #666;"><strong>⏱️ End Time:</strong></td>
              <td style="padding: 10px 0; color: #af0c3e; text-align: right;"><strong>${formattedEnd}</strong></td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
              <td style="padding: 10px 0; color: #666;"><strong>⏳ Duration:</strong></td>
              <td style="padding: 10px 0; color: #af0c3e; text-align: right;"><strong>${durationMinutes} minutes</strong></td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #e8f4f8; border-left: 4px solid #0288d1; padding: 15px; margin: 25px 0; border-radius: 4px;">
          <p style="margin: 0; color: #01579b; font-size: 15px; line-height: 1.6;">
            <strong>ℹ️ Important:</strong> Make sure you log in to your examination portal before the start time. You will only be able to start the exam during the scheduled window.
          </p>
        </div>
        
        <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 25px 0;">If you have any questions about this exam, please contact your instructor or the examination support team.</p>
        
        <p style="font-size: 13px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; line-height: 1.6;">
          Online Examination System<br>
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(studentEmail, subject, html, 'NEW_EXAM_NOTIFICATION');
}
