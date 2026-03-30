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
  const subject = `✅ Exam Submitted Successfully - ${examTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #28a745;">Exam Submitted Successfully! ✅</h2>
      
      <p>Dear <strong>${studentName}</strong>,</p>
      
      <p>Your exam has been submitted successfully. Here are your results:</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Exam Title:</strong> ${examTitle}</p>
        <p><strong>Score:</strong> ${score}/${totalMarks}</p>
        <p><strong>Percentage:</strong> <span style="font-size: 24px; color: #28a745;"><strong>${percentage}%</strong></span></p>
      </div>
      
      <p>Your submission has been recorded in the system. You can view your detailed results in your exam portal.</p>
      
      <p style="color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px;">
        This is an automated email from Online Exam System. Please do not reply to this email.
      </p>
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
  const subject = `⏰ Exam Not Submitted - ${examTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #dc3545;">⏰ Exam Not Submitted</h2>
      
      <p>Dear <strong>${studentName}</strong>,</p>
      
      <p>We noticed that you did not submit your exam. Here are the details:</p>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p><strong>Exam Title:</strong> ${examTitle}</p>
        <p><strong>Status:</strong> <span style="color: #dc3545;"><strong>Not Submitted</strong></span></p>
        <p><strong>Reason:</strong> ${reason}</p>
      </div>
      
      <p>If you believe this is an error or need to retake this exam, please contact your professor.</p>
      
      <p style="color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px;">
        This is an automated email from Online Exam System. Please do not reply to this email.
      </p>
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
      <h4 style="margin-top: 20px; color: #333;">Top Performers:</h4>
      <ol style="color: #555;">
        ${topScores.map((score, index) => `
          <li>${score.studentName}: ${score.percentage}% (${score.score}/${score.totalMarks})</li>
        `).join('')}
      </ol>
    `;
  }

  const subject = `📊 Exam Completed - ${examTitle} - Results Summary`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #007bff;">📊 Exam Completion Summary</h2>
      
      <p>Dear <strong>${professorName}</strong>,</p>
      
      <p>Your exam <strong>"${examTitle}"</strong> has concluded. Here is the summary of submissions:</p>
      
      <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Total Students:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;"><strong>${totalStudents}</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Submitted:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;"><strong style="color: #28a745;">${submittedCount}</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Not Submitted:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;"><strong style="color: #dc3545;">${notSubmittedCount}</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Submission Rate:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;"><strong>${submissionRate}%</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px;"><strong>Average Score:</strong></td>
            <td style="padding: 10px; text-align: right;"><strong style="color: #007bff;">${averageScore}%</strong></td>
          </tr>
        </table>
      </div>
      
      ${topScoresHtml}
      
      <p style="margin-top: 20px;">Login to your professor dashboard to view detailed analysis and student results.</p>
      
      <p style="color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px;">
        This is an automated email from Online Exam System. Please do not reply to this email.
      </p>
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

  const subject = '🔐 Password Reset Request';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #007bff;">🔐 Password Reset Request</h2>
      
      <p>Hello <strong>${userName}</strong>,</p>
      
      <p>We received a request to reset your password. If you made this request, click the button below to proceed:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Reset Your Password
        </a>
      </div>
      
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
        ${resetLink}
      </p>
      
      <div style="background-color: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0; color: #856404;">
          <strong>⚠️ Security Note:</strong> This link will expire in 1 hour. If you did not request a password reset, please ignore this email. Your account remains secure.
        </p>
      </div>
      
      <p style="color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px;">
        This is an automated email from Online Exam System. Please do not reply to this email.
      </p>
    </div>
  `;

  return await sendEmail(email, subject, html, 'PASSWORD_RESET');
}

/**
 * Send password changed confirmation email
 * @param {string} email - User email address
 * @param {string} userName - User name
 */
export async function sendPasswordChangedEmail(email, userName) {
  const subject = '✅ Password Changed Successfully';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #28a745;">✅ Password Changed</h2>
      
      <p>Hello <strong>${userName}</strong>,</p>
      
      <p>Your password has been changed successfully. If you did not make this change, please contact support immediately.</p>
      
      <div style="background-color: #d4edda; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #28a745;">
        <p style="margin: 0; color: #155724;">
          Your account is now using the new password.
        </p>
      </div>
      
      <p style="color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px;">
        This is an automated email from Online Exam System. Please do not reply to this email.
      </p>
    </div>
  `;

  return await sendEmail(email, subject, html, 'PASSWORD_CHANGED');
}
