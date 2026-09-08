import mongoose from 'mongoose';

const SubmissionSchema = new mongoose.Schema({
  // The user's provided credentials
  loginId: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  // Details of the property
  tp: String,
  op: String,
  fp: String,
  area: String,
  location: String,
  parentLocation: String,
  landmark: String,
  type: String,
  remarks: String,
  partyName: String,
  partyPhone: String,
  brokerName: String,
  brokerPhone: String,
  // The drawn polygon coordinates
  coordinates: {
    type: Array, // Array of {lat, lng}
    required: true
  },
  // Status of the submission
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

export default mongoose.model('Submission', SubmissionSchema);
