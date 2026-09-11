import mongoose from 'mongoose';

const SubmissionSchema = new mongoose.Schema({
  // The viewer account that submitted this request
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Denormalized for display without a join (e.g. admin panel, Google Sheet sync)
  username: {
    type: String,
    required: true,
  },
  // Details of the property
  tp: String,
  op: String,
  fp: String,
  area: String,
  areaUnit: String,
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
