#!/usr/bin/env node

/**
 * Simple test to demonstrate Zod validation working
 */

const { z } = require('zod');

// Same schemas as in the main code
const SearchRecordsSchema = z.object({
  model: z.string().min(1, "Model name cannot be empty"),
  domain: z.array(z.array(z.any())).default([]),
  fields: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().min(0).default(0),
  order: z.string().optional()
});

console.log('Testing Zod validation...\n');

// Test 1: Valid input
console.log('✅ Test 1 - Valid input:');
try {
  const result = SearchRecordsSchema.parse({
    model: 'res.partner',
    limit: 10,
    offset: 0
  });
  console.log('Parsed result:', result);
} catch (error) {
  console.log('Error:', error.message);
}

// Test 2: Invalid input (empty model)
console.log('\n❌ Test 2 - Invalid input (empty model):');
try {
  const result = SearchRecordsSchema.parse({
    model: '',
    limit: 10
  });
  console.log('Parsed result:', result);
} catch (error) {
  console.log('Validation Error:', error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
}

// Test 3: Invalid input (negative limit)
console.log('\n❌ Test 3 - Invalid input (negative limit):');
try {
  const result = SearchRecordsSchema.parse({
    model: 'res.partner',
    limit: -5
  });
  console.log('Parsed result:', result);
} catch (error) {
  console.log('Validation Error:', error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
}

// Test 4: Invalid input (limit too high)
console.log('\n❌ Test 4 - Invalid input (limit too high):');
try {
  const result = SearchRecordsSchema.parse({
    model: 'res.partner',
    limit: 1500
  });
  console.log('Parsed result:', result);
} catch (error) {
  console.log('Validation Error:', error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
}

console.log('\nValidation tests completed!');
