/**
 * Swagger/OpenAPI Configuration.
 * Generates OpenAPI 3.0 spec from JSDoc annotations in route files.
 */
const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Enterprise Commerce Platform API',
      version: '1.0.0',
      description: 'Scalable REST API backend for the Enterprise Commerce Platform. Provides authentication, user management, product catalog, and order processing with JWT-based security and role-based access control.',
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from /api/auth/login',
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Service health check' },
      { name: 'Authentication', description: 'User registration and login' },
      { name: 'Users', description: 'User management (admin only)' },
      { name: 'Products', description: 'Product catalog operations' },
      { name: 'Orders', description: 'Order management' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
