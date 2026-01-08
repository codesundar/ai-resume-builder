const fs = require('fs').promises;
require('dotenv').config();
const { OpenAI } = require('openai');

// File paths
const USER_PROFILE_PATH = './input/user-profile.txt';
const JOB_DESCRIPTION_PATH = './input/job-description.txt';
const RESUME_TEMPLATE_PATH = './resume-template.html';
const OUTPUT_RESUME_PATH = './output/generated-resume.html';

// Initialize OpenAI client
let openai;
try {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in .env file');
  }
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
} catch (error) {
  console.error(`Error initializing OpenAI client: ${error.message}`);
  console.error('Please make sure you have set the OPENAI_API_KEY in your .env file');
  process.exit(1);
}

/**
 * Read file content
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - File content
 */
async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Error reading file ${filePath}: ${error.message}`);
  }
}

/**
 * Parse user profile from text
 * @param {string} text - User profile text
 * @returns {Object} - Parsed user profile
 */
function parseUserProfile(text) {
  const profile = {};
  
  // Extract name, email, phone, etc.
  const nameMatch = text.match(/Name:\s*(.+)/);
  profile.name = nameMatch ? nameMatch[1].trim() : '';
  
  const emailMatch = text.match(/Email:\s*(.+)/);
  profile.email = emailMatch ? emailMatch[1].trim() : '';
  
  const phoneMatch = text.match(/Phone:\s*(.+)/);
  profile.phone = phoneMatch ? phoneMatch[1].trim() : '';
  
  const linkedinMatch = text.match(/LinkedIn:\s*(.+)/);
  profile.linkedin = linkedinMatch ? linkedinMatch[1].trim() : '';
  
  const githubMatch = text.match(/GitHub:\s*(.+)/);
  profile.github = githubMatch ? githubMatch[1].trim() : '';
  
  const websiteMatch = text.match(/Website:\s*(.+)/);
  profile.website = websiteMatch ? websiteMatch[1].trim() : '';
  
  // Extract tagline from summary or set a default
  const summaryLines = profile.summary ? profile.summary.split('\n') : [];
  profile.tagline = summaryLines.length > 0 ? summaryLines[0].trim() : '';
  
  // Extract sections
  const sections = ['SUMMARY', 'SKILLS', 'EXPERIENCE', 'EDUCATION', 'PROJECTS', 'CERTIFICATIONS', 'ACHIEVEMENTS'];
  
  sections.forEach((section, index) => {
    const sectionKey = section.toLowerCase();
    const nextSection = sections[index + 1];
    
    const sectionRegex = new RegExp(`${section}\\s*\\n([\\s\\S]*?)${nextSection ? `\\n${nextSection}\\s*\\n` : '$'}`, 'i');
    const sectionMatch = text.match(sectionRegex);
    
    if (sectionMatch) {
      profile[sectionKey] = sectionMatch[1].trim();
    } else {
      profile[sectionKey] = '';
    }
  });
  
  return profile;
}

/**
 * Generate optimized resume content using OpenAI
 * @param {Object} profile - User profile data
 * @param {string} jobDescription - Job description text
 * @returns {Promise<Object>} - Optimized resume content
 */
async function generateOptimizedResume(profile, jobDescription) {
  try {
    console.log('Generating optimized resume with OpenAI...');
    
    const prompt = `
    USER PROFILE:
    ${JSON.stringify(profile, null, 2)}
    
    JOB DESCRIPTION:
    ${jobDescription}
    
    Please optimize the resume content to match this job description in FAANG-style resume standards. Highlight relevant skills and experiences. The resume should be concise and fit on a single page. IMPORTANT: Include ALL experience entries from the user profile - do not omit any job positions.
    
    Return the following sections in plain text format (not JSON):
    
    NAME: ${profile.name}
    EMAIL: ${profile.email}
    PHONE: ${profile.phone}
    LINKEDIN: ${profile.linkedin}
    GITHUB: ${profile.github}
    WEBSITE: ${profile.website}
    TAGLINE: ${profile.tagline}
    
    SKILLS:
    [Format skills as HTML spans with class="skill"]
    <span class="skill">Skill 1</span>
    <span class="skill">Skill 2</span>
    
    EXPERIENCE:
    [Format experience as HTML with proper structure]
    <div class="experience-item">
      <div class="experience-header">
        <div class="job-title-company">Job Title, Company</div>
        <div class="date">Date Range</div>
      </div>
      <ul class="experience-bullets">
        <li>Achievement-oriented bullet point with metrics</li>
      </ul>
    </div>
    
    ACHIEVEMENTS:
    [Format achievements as HTML bullet points]
    <ul class="achievements-bullets">
      <li>Specific achievement with metrics</li>
      <li>Another achievement with quantifiable results</li>
    </ul>
    
    PROJECTS:
    [Format projects as HTML with proper structure]
    <div class="project-item">
      <strong>Project Name</strong>
      <div>Project description and technologies used</div>
    </div>
    
    CERTIFICATIONS:
    [Format certifications as HTML list]
    <ul class="compact-list">
      <li>Certification 1</li>
      <li>Certification 2</li>
    </ul>
    
    EDUCATION:
    [Format education as HTML with proper structure]
    <div class="education-item">
      <strong>Degree, Institution</strong>
      <div>Year</div>
    </div>
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a professional resume writer who tailors resumes to specific job descriptions." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    const content = response.choices[0].message.content;
    console.log('OpenAI response received');
    
    // Parse the response as plain text sections
    const result = {};
    
    // Extract basic information (these should already be correct from the profile)
    result.name = profile.name;
    result.email = profile.email;
    result.phone = profile.phone;
    result.linkedin = profile.linkedin;
    result.github = profile.github;
    
    // Extract website field
    const websiteMatch = content.match(/WEBSITE:\s*([^\n]+)/i);
    result.website = websiteMatch ? websiteMatch[1].trim() : profile.website;
    
    // Extract tagline
    const taglineMatch = content.match(/TAGLINE:\s*([^\n]+)/i);
    result.tagline = taglineMatch ? taglineMatch[1].trim() : profile.tagline;
    
    const skillsMatch = content.match(/SKILLS:\s*([\s\S]*?)(?=\s*\n\s*EXPERIENCE:|$)/i);
    result.skills = skillsMatch ? skillsMatch[1].trim() : formatSkills(profile.skills);
    
    // For experience, we'll check if all entries are included
    const experienceMatch = content.match(/EXPERIENCE:\s*([\s\S]*?)(?=\s*\n\s*ACHIEVEMENTS:|$)/i);
    const extractedExperience = experienceMatch ? experienceMatch[1].trim() : '';
    
    // Check if all experience entries are included by counting job positions
    const profileExpEntries = profile.experience.split(/\n\n(?=[A-Za-z])/g).length;
    const extractedExpEntries = extractedExperience.split('experience-item').length - 1;
    
    // If OpenAI didn't include all entries, use our formatter
    result.experience = (extractedExperience && extractedExpEntries >= profileExpEntries) ? 
      extractedExperience : formatExperience(profile.experience);
    
    const achievementsMatch = content.match(/ACHIEVEMENTS:\s*([\s\S]*?)(?=\s*\n\s*PROJECTS:|$)/i);
    result.achievements = achievementsMatch ? achievementsMatch[1].trim() : formatAchievements(profile.achievements);
    
    const projectsMatch = content.match(/PROJECTS:\s*([\s\S]*?)(?=\s*\n\s*CERTIFICATIONS:|$)/i);
    result.projects = projectsMatch ? projectsMatch[1].trim() : formatProjects(profile.projects);
    
    const certificationsMatch = content.match(/CERTIFICATIONS:\s*([\s\S]*?)(?=\s*\n\s*EDUCATION:|$)/i);
    result.certifications = certificationsMatch ? certificationsMatch[1].trim() : formatCertifications(profile.certifications);
    
    const educationMatch = content.match(/EDUCATION:\s*([\s\S]*?)(?=$)/i);
    result.education = educationMatch ? educationMatch[1].trim() : formatEducation(profile.education);
    
    return result;
  } catch (error) {
    console.error('Error generating optimized resume:', error);
    
    // Fallback to original profile with formatted content
    return {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      linkedin: profile.linkedin,
      github: profile.github,
      summary: profile.summary,
      skills: formatSkills(profile.skills),
      experience: formatExperience(profile.experience),
      achievements: formatAchievements(profile.achievements),
      projects: formatProjects(profile.projects),
      certifications: formatCertifications(profile.certifications),
      education: formatEducation(profile.education)
    };
  }
}

/**
 * Format skills as HTML spans
 * @param {string} skills - Skills text
 * @returns {string} - Formatted HTML
 */
function formatSkills(skills) {
  if (!skills) return '<span class="skill">No skills provided</span>';
  
  return skills.split('-')
    .filter(s => s.trim())
    .map(skill => `<span class="skill">${skill.trim()}</span>`)
    .join(' ');
}

/**
 * Format experience as HTML
 * @param {string} experience - Experience text
 * @returns {string} - Formatted HTML
 */
function formatExperience(experience) {
  if (!experience) return '<p>Experience details not available</p>';
  
  // Split by double newline followed by a word character (to separate job entries)
  const entries = experience.split(/\n\n(?=[A-Za-z])/g);
  
  // Filter out entries that are not job positions (like ACHIEVEMENTS section)
  const jobEntries = entries.filter(entry => {
    const firstLine = entry.split('\n')[0].trim();
    // Check if this is a section header rather than a job title
    return !firstLine.match(/^ACHIEVEMENTS|^EDUCATION|^PROJECTS|^CERTIFICATIONS|^SKILLS/i);
  });
  
  // Process each job entry
  return jobEntries.map(exp => {
    const lines = exp.split('\n');
    
    // Extract job details from first line
    const firstLine = lines[0].trim();
    let jobTitle = '', company = '', location = '', dateRange = '';
    
    // Parse the job header line
    if (firstLine.includes('|')) {
      const parts = firstLine.split('|').map(s => s.trim());
      jobTitle = parts[0] || 'Position';
      company = parts[1] || '';
      location = parts.length > 2 ? parts[2] : '';
    } else {
      jobTitle = firstLine;
    }
    
    // Find date range (usually the second line)
    if (lines.length > 1) {
      const potentialDateLine = lines[1].trim();
      if (potentialDateLine.includes('–') || potentialDateLine.includes('-')) {
        dateRange = potentialDateLine;
        // Remove the date line from further processing
        lines.splice(1, 1);
      }
    }
    
    // Process bullet points, enhancing them with result-oriented outcomes if needed
    const bullets = lines.slice(1).filter(line => line.trim().length > 0);
    let bulletPoints = '';
    
    if (bullets.length > 0) {
      bulletPoints = bullets.map(bullet => {
        // Clean up the bullet point
        let cleanBullet = bullet.trim().replace(/^-\s*/, '');
        
        // Check if the bullet already has a result-oriented outcome
        if (!cleanBullet.includes('resulting in') && 
            !cleanBullet.includes('increased') && 
            !cleanBullet.includes('decreased') && 
            !cleanBullet.includes('improved') && 
            !cleanBullet.includes('reduced') && 
            !cleanBullet.includes('achieved') && 
            !cleanBullet.includes('by') && 
            !cleanBullet.match(/\d+%/)) {
          // Add a placeholder for metrics if none exist
          // cleanBullet += ' resulting in significant improvements';
        }
        
        return `<li>${cleanBullet}</li>`;
      }).join('');
    } else {
      bulletPoints = '<li>Responsible for key initiatives and projects with measurable outcomes</li>';
    }
    
    return `
      <div class="experience-item">
        <div class="experience-header">
          <div class="job-title-company">${jobTitle}${company ? `, ${company}` : ''}</div>
          <div class="date">${dateRange}</div>
        </div>
        <ul class="experience-bullets">
          ${bulletPoints}
        </ul>
      </div>`;
  }).join('');
}

/**
 * Format achievements as HTML bullet points
 * @param {string} achievements - Achievements text
 * @returns {string} - Formatted HTML
 */
function formatAchievements(achievements) {
  if (!achievements) {
    return `
      <ul class="achievements-bullets">
        <li>Successfully delivered key projects ahead of schedule</li>
        <li>Recognized for excellence in technical leadership</li>
        <li>Improved system performance by 40% through optimization</li>
      </ul>`;
  }
  
  const items = achievements.split('-')
    .filter(s => s.trim())
    .map(achievement => `<li>${achievement.trim()}</li>`)
    .join('');
  
  return `<ul class="achievements-bullets">${items}</ul>`;
}

/**
 * Format projects as HTML
 * @param {string} projects - Projects text
 * @returns {string} - Formatted HTML
 */
function formatProjects(projects) {
  if (!projects) return '<p>Project details not available</p>';
  
  return projects.split(/\n\n(?=[A-Za-z])/g).map(proj => {
    const lines = proj.split('\n');
    const projectName = lines[0];
    const details = lines.slice(1).join(' ');
    return `<div class="project-item"><strong>${projectName}</strong><div>${details}</div></div>`;
  }).join('');
}

/**
 * Format certifications as HTML list
 * @param {string} certifications - Certifications text
 * @returns {string} - Formatted HTML
 */
function formatCertifications(certifications) {
  if (!certifications) return '<ul class="compact-list"><li>No certifications provided</li></ul>';
  
  const items = certifications.split('-')
    .filter(s => s.trim())
    .map(cert => `<li>${cert.trim()}</li>`)
    .join('');
  
  return `<ul class="compact-list">${items}</ul>`;
}

/**
 * Format education as HTML
 * @param {string} education - Education text
 * @returns {string} - Formatted HTML
 */
function formatEducation(education) {
  if (!education) return '<p>Education details not available</p>';
  
  return education.split(/\n\n(?=[A-Za-z])/g).map(edu => {
    const lines = edu.split('\n');
    return `<div class="education-item"><strong>${lines[0]}</strong>${lines.length > 1 ? `<div>${lines.slice(1).join(' ')}</div>` : ''}</div>`;
  }).join('');
}

/**
 * Generate HTML resume from template and optimized content
 * @param {string} template - HTML template
 * @param {Object} content - Resume content
 * @returns {string} - Generated HTML resume
 */
function generateHtmlResume(template, content) {
  let html = template;
  
  // Replace placeholders with content
  Object.keys(content).forEach(key => {
    const placeholder = `{{${key}}}`;
    html = html.replace(new RegExp(placeholder, 'g'), content[key] || '');
  });
  
  return html;
}

/**
 * Main function to generate resume
 */
async function main() {
  try {
    console.log('Reading input files...');
    const [userProfileText, jobDescriptionText, resumeTemplate] = await Promise.all([
      readFile(USER_PROFILE_PATH),
      readFile(JOB_DESCRIPTION_PATH),
      readFile(RESUME_TEMPLATE_PATH)
    ]);
    
    console.log('Parsing user profile...');
    const userProfile = parseUserProfile(userProfileText);
    
    console.log('Generating optimized resume content...');
    const optimizedContent = await generateOptimizedResume(userProfile, jobDescriptionText);
    
    console.log('Generating HTML resume...');
    const htmlResume = generateHtmlResume(resumeTemplate, optimizedContent);
    
    console.log('Writing generated resume to file...');
    await fs.writeFile(OUTPUT_RESUME_PATH, htmlResume);
    
    console.log(`Resume successfully generated at: ${OUTPUT_RESUME_PATH}`);
  } catch (error) {
    console.error('Error generating resume:', error);
    process.exit(1);
  }
}

// Run the script
main();
