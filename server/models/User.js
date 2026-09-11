import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3
  },
  passwordHash: {
    type: String,
    required: true
  }
}, { timestamps: true });

export default mongoose.model('User', UserSchema);
