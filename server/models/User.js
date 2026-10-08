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
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true
  },
  // Collected on the sign-up form so admins can see who an account belongs to.
  firstName: { type: String, trim: true, default: '' },
  lastName: { type: String, trim: true, default: '' },
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
  },
  // Admin "block user": the account still exists (and keeps its submissions) but can't
  // sign in or use the viewer API until an admin unblocks it.
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export default mongoose.model('User', UserSchema);
