const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    return false;
  }
};

module.exports = connectDB;
