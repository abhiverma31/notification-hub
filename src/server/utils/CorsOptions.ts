import cors from 'cors';

// const allowedOrigin = process.env.NODE_ENV === 'local' ? 'http://localhost:5173' : process.env.CORS_WHITELIST_ORIGIN;

const CorsOptions: cors.CorsOptions = {
  origin: true,
  credentials: true,
};

export default CorsOptions;
