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
  },
  // Soft delete: admin "delete user" marks the account inactive rather than
  // removing the row, so their existing submissions (which reference this
  // user by id) stay intact and auditable rather than orphaned or cascaded away.
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export default mongoose.model('User', UserSchema);
