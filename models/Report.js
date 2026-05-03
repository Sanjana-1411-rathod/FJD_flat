const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  location: {
    type: String
  },
  description: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  jobRole: {
    type: String
  },
  reportedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Report', reportSchema);
