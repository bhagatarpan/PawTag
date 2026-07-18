import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PawTag API',
      version: '0.1.0',
      description: 'PawTag Pet Recovery Platform - REST API',
      contact: {
        name: 'PawTag Support',
        email: 'support@pawtag.co.nz',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            phoneNumber: { type: 'string' },
            role: { type: 'string', enum: ['super_admin', 'admin', 'support', 'customer'] },
            status: { type: 'string', enum: ['active', 'inactive', 'suspended', 'pending_verification'] },
            emailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PetPhoto: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
            caption: { type: 'string' },
            isMain: { type: 'boolean' },
            addedAt: { type: 'string', format: 'date-time' },
          },
        },
        Pet: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            ownerId: { type: 'string' },
            name: { type: 'string' },
            petType: { type: 'string', enum: ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'], description: 'Type of pet' },
            species: { type: 'string', description: 'Species (kept for backward compat)' },
            breed: { type: 'string' },
            secondaryBreed: { type: 'string', description: 'Secondary breed when breed is Mixed Breed' },
            gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
            color: { type: 'string' },
            pattern: { type: 'string', description: 'Coat pattern (e.g. Merle, Tabby, Solid)' },
            photos: { type: 'array', items: { $ref: '#/components/schemas/PetPhoto' }, maxItems: 5, description: 'Up to 5 pet photos' },
            photoUrl: { type: 'string', description: 'Legacy single photo URL' },
            status: { type: 'string', enum: ['safe', 'lost', 'found'] },
            medicalAlerts: { type: 'string' },
          },
        },
        CreatePetInput: {
          type: 'object',
          required: ['name', 'species', 'breed', 'color'],
          properties: {
            name: { type: 'string' },
            petType: { type: 'string', enum: ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'] },
            species: { type: 'string' },
            breed: { type: 'string' },
            secondaryBreed: { type: 'string' },
            gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
            color: { type: 'string' },
            pattern: { type: 'string' },
            photos: { type: 'array', items: { $ref: '#/components/schemas/PetPhoto' }, maxItems: 5 },
            photoUrl: { type: 'string' },
            medicalAlerts: { type: 'string' },
            microchipId: { type: 'string' },
            isNeutered: { type: 'boolean' },
            notes: { type: 'string' },
          },
        },
        Tag: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tagId: { type: 'string', description: 'Human-readable tag ID like PT-123456' },
            petId: { type: 'string' },
            ownerId: { type: 'string' },
            status: { type: 'string', enum: ['active', 'inactive', 'lost'] },
            lastScannedAt: { type: 'string', format: 'date-time' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            currency: { type: 'string' },
            category: { type: 'string' },
            stock: { type: 'integer' },
            sku: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            orderNumber: { type: 'string' },
            userId: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  productName: { type: 'string' },
                  quantity: { type: 'integer' },
                  unitPrice: { type: 'number' },
                  totalPrice: { type: 'number' },
                },
              },
            },
            status: { type: 'string', enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'] },
            payment: {
              type: 'object',
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'fullName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            fullName: { type: 'string', minLength: 2 },
            phoneNumber: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
