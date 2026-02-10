const { validateEnvVars } = require('../../src/utils/envValidator');

describe('Environment Validator', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('should return valid if development has no required variables by default', () => {
        process.env.NODE_ENV = 'development';
        const result = validateEnvVars('development');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('should return errors if production is missing required variables', () => {
        process.env.NODE_ENV = 'production';
        // Ensure required vars are missing
        delete process.env.JWT_SECRET;
        delete process.env.SESSION_SECRET;

        const result = validateEnvVars('production');
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors).toContainEqual(expect.stringContaining('JWT_SECRET'));
    });

    test('should return valid if production has all required variables', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'super_secret_key_that_is_long_enough';
        process.env.SESSION_SECRET = 'super_session_secret_that_is_long_enough';
        process.env.DB_HOST = 'localhost';
        process.env.DB_USER = 'root';
        process.env.DB_NAME = 'test_db';

        const result = validateEnvVars('production');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test('should warn if secrets are too short', () => {
        process.env.JWT_SECRET = 'short';
        const result = validateEnvVars('development');
        // Depending on logic, this might be valid but have warnings
        expect(result.warnings).toEqual(
            expect.arrayContaining([expect.stringContaining('JWT_SECRET')])
        );
    });
});
