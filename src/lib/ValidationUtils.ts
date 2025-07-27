import { Gist, ValidationError } from '../types/index.js';

/**
 * Runtime validation utilities for external data
 */
export class ValidationUtils {
  /**
   * Validates that a value is a non-null object
   */
  static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Validates that a value is a string
   */
  static isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  /**
   * Validates that a value is an array
   */
  static isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  }

  /**
   * Validates a gist object structure from GitHub API
   */
  static validateGist(data: unknown): asserts data is Gist {
    if (!this.isObject(data)) {
      throw new ValidationError('Gist data must be an object', data);
    }

    const requiredFields = ['id', 'html_url', 'created_at', 'updated_at', 'files', 'public'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new ValidationError(`Missing required field: ${field}`, data);
      }
    }

    if (!this.isString(data.id)) {
      throw new ValidationError('Gist id must be a string', data);
    }

    if (!this.isString(data.html_url)) {
      throw new ValidationError('Gist html_url must be a string', data);
    }

    if (!this.isString(data.created_at)) {
      throw new ValidationError('Gist created_at must be a string', data);
    }

    if (!this.isString(data.updated_at)) {
      throw new ValidationError('Gist updated_at must be a string', data);
    }

    if (!this.isObject(data.files)) {
      throw new ValidationError('Gist files must be an object', data);
    }

    if (typeof data.public !== 'boolean') {
      throw new ValidationError('Gist public must be a boolean', data);
    }
  }

  /**
   * Validates an array of gists from GitHub API
   */
  static validateGistsArray(data: unknown): asserts data is Gist[] {
    if (!this.isArray(data)) {
      throw new ValidationError('Gists data must be an array', data);
    }

    for (let i = 0; i < data.length; i++) {
      try {
        this.validateGist(data[i]);
      } catch (error) {
        throw new ValidationError(`Invalid gist at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`, data[i]);
      }
    }
  }

  /**
   * Type guard for Response object
   */
  static isResponse(value: unknown): value is Response {
    return value instanceof Response;
  }
}
