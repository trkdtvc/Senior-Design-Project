const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Senior Design Project API",
      version: "1.0.0",
      description: "API documentation for the Senior Design Project backend"
    },
    servers: [
      {
        url: process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`,
        description:
          process.env.NODE_ENV === "production"
            ? "Production server"
            : "Local development server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  },
  apis: [path.join(__dirname, "..", "routes", "*.js")]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;