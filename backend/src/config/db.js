import mongoose from "mongoose";

const connectDB = async () => {
  if (process.env.NODE_ENV === "test" && !process.env.FORCE_DB) {
    return;
  }
  try {
    const connection = await mongoose.connect(process.env.MONGO_URI);

    console.log(
      `MongoDB connected: ${connection.connection.host}`
    );
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;