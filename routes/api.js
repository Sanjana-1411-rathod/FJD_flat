const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const Report = require('../models/Report');

const upload = multer({ dest: 'uploads/' });

// Initialize Gemini API client (ensure GEMINI_API_KEY is in .env)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// POST /analyze/job
// Analyzes a job description text, link, or image
router.post('/analyze/job', upload.single('image'), async (req, res) => {
  try {
    const { text, link } = req.body;
    
    if (!text && !link && !req.file) {
      return res.status(400).json({ error: 'Please provide text, link, or an image' });
    }

    let prompt = `
      You are an expert Fake Job Posting Detector AI.
      Analyze the following job posting. If it's a link, try to deduce from the URL. Otherwise, analyze the text.
      Determine if it is a real job, suspicious, or a fake scam.
      Pay attention to: high salary for basic skills, urgent hiring, asking for money, missing company details, generic email addresses.
      
      Return ONLY a JSON response in the exact following format, without markdown formatting:
      {
        "score": <number 0-100 where 100 is 100% fake>,
        "verdict": "<Real, Suspicious, or Fake>",
        "riskLevel": "<Low, Medium, or High>",
        "explanation": "<Detailed reason for your verdict>",
        "suspiciousPhrases": ["<phrase1>", "<phrase2>"]
      }
    `;

    let response;
    
    // Check if API key is valid
    const hasValidKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';

    if (!hasValidKey) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "API Key Missing: Please configure your Gemini API key in the backend/.env file for real analysis." });
    }

    if (req.file) {
      
      // Handle Image Analysis
      const fileBytes = fs.readFileSync(req.file.path);
      const base64Image = Buffer.from(fileBytes).toString("base64");
      const mimeType = req.file.mimetype;
      
      prompt += `\nAnalyze the text in this image of a job posting.`;
      
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            prompt,
            { inlineData: { data: base64Image, mimeType: mimeType } }
        ]
      });
      fs.unlinkSync(req.file.path); // cleanup
    } else {

      // Handle Text/Link
      prompt += `
      Job Details:
      ${text || ''}
      ${link ? `Link: ${link}` : ''}
      `;
      response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
      });
    }

    let jsonStr = response.text;
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '');
    }

    const result = JSON.parse(jsonStr);
    res.json(result);
  } catch (error) {
    console.error('Error analyzing job:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to analyze job posting' });
  }
});

// POST /analyze/logo
router.post('/analyze/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo file provided' });
    }
    
    // Convert file to base64 for Gemini Vision
    const fileBytes = fs.readFileSync(req.file.path);
    const base64Image = Buffer.from(fileBytes).toString("base64");
    const mimeType = req.file.mimetype;

    const hasValidKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';
    if (!hasValidKey) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "API Key Missing: Please configure your Gemini API key in the backend/.env file for real analysis." });
    }

    const prompt = `
      Analyze this company logo. Does it look legitimate, or does it look like a low-quality, 
      fake, or slightly altered version of a real company's logo (common in phishing and job scams)?
      
      Return ONLY a JSON response in the exact following format, without markdown formatting:
      {
        "authenticity": "<High, Medium, or Low>",
        "details": "<Your analysis of the image quality and authenticity>"
      }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            prompt,
            { inlineData: { data: base64Image, mimeType: mimeType } }
        ]
    });
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    let jsonStr = response.text;
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '');

    res.json(JSON.parse(jsonStr));
  } catch (error) {
    console.error('Error analyzing logo:', error);
    // Cleanup on error
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to analyze logo' });
  }
});

// POST /analyze/resume
router.post('/analyze/resume', upload.single('resume'), async (req, res) => {
  try {
    const { jobDescription } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No resume provided' });
    if (!jobDescription) return res.status(400).json({ error: 'No job description provided' });

    let resumeText = '';
    
    if (req.file.mimetype === 'application/pdf') {
       const pdfBuffer = fs.readFileSync(req.file.path);
       const data = await pdfParse(pdfBuffer);
       resumeText = data.text;
    } else {
       resumeText = fs.readFileSync(req.file.path, 'utf8'); // fallback for text files
    }

    fs.unlinkSync(req.file.path); // cleanup

    const hasValidKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';
    if (!hasValidKey) {
      return res.status(400).json({ error: "API Key Missing: Please configure your Gemini API key in the backend/.env file for real analysis." });
    }

    const prompt = `
      You are an AI career advisor. Check if this job description matches the provided resume, 
      and more importantly, check if the job seems safe or like a scam trying to harvest resumes.
      
      Job Description: ${jobDescription}
      
      Resume Text: ${resumeText.substring(0, 3000)}...
      
      Return ONLY JSON:
      {
        "matchScore": <number 0-100>,
        "isSafe": <boolean>,
        "advice": "<Detailed advice>"
      }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    let jsonStr = response.text;
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '');
    res.json(JSON.parse(jsonStr));
  } catch (error) {
    console.error('Error analyzing resume:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to analyze resume' });
  }
});

// POST /report
router.post('/report', async (req, res) => {
  try {
    const newReport = new Report(req.body);
    await newReport.save();
    res.status(201).json({ message: 'Report submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// GET /trends
router.get('/trends', async (req, res) => {
  try {
    // In a real app, this would aggregate from the DB. 
    // We'll return mock data for the dashboard charts as per requirements.
    const trends = {
      commonTypes: [
        { name: 'Data Entry Scam', value: 45 },
        { name: 'Reshipping Scam', value: 25 },
        { name: 'Pyramid Scheme', value: 20 },
        { name: 'Fake Check', value: 10 }
      ],
      targetedRoles: [
        { role: 'Virtual Assistant', count: 120 },
        { role: 'Software Engineer', count: 45 },
        { role: 'Customer Service', count: 85 },
        { role: 'Data Analyst', count: 30 }
      ],
      salaryComparison: [
        { role: 'Data Entry', realAvg: 35000, scamAvg: 85000 },
        { role: 'Virtual Asst', realAvg: 40000, scamAvg: 90000 },
        { role: 'Customer Service', realAvg: 38000, scamAvg: 70000 }
      ]
    };
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// GET /map
router.get('/map', async (req, res) => {
  try {
    // Mock map data showing scam locations
    const mapData = [
      { id: 1, lat: 40.7128, lng: -74.0060, location: 'New York, USA', count: 150 },
      { id: 2, lat: 51.5074, lng: -0.1278, location: 'London, UK', count: 85 },
      { id: 3, lat: 28.6139, lng: 77.2090, location: 'New Delhi, India', count: 210 },
      { id: 4, lat: 6.5244, lng: 3.3792, location: 'Lagos, Nigeria', count: 120 },
      { id: 5, lat: 1.3521, lng: 103.8198, location: 'Singapore', count: 45 }
    ];
    res.json(mapData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

// POST /chat
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    const prompt = `You are a helpful assistant for a Fake Job Posting Detection System.
    User asks: "${message}"
    Provide a concise, helpful, and polite answer advising them on job safety.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    res.json({ reply: response.text });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get chat response' });
  }
});

module.exports = router;
