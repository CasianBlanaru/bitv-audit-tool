// src/constants.js

/**
 * BITV/WCAG Categories
 * Structured according to WCAG 2.1 principles
 */
export const BITV_CATEGORIES = {
  WAHRNEHMBAR: 'Perceivable',
  BEDIENBAR: 'Operable',
  VERSTAENDLICH: 'Understandable',
  ROBUST: 'Robust',
};

/**
 * Severity Levels with Impact Description
 * Based on WCAG 2.1 and EN 301 549 requirements
 */
export const SEVERITY_LEVELS = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

/**
 * Test Standards
 * Defines supported accessibility standards
 */
const TEST_STANDARDS = {
  WCAG21: 'WCAG 2.1',
  BITV20: 'BITV 2.0',
  EN301549: 'EN 301 549 V3.2.1',
};

/**
 * Error Points Configuration
 * Used for calculating accessibility score
 */
const ERROR_POINTS = {
  CRITICAL: 15,
  HIGH: 10,
  MEDIUM: 6,
  LOW: 3,
};

/**
 * Score Thresholds
 * Defines compliance levels based on weighted score
 */
const COMPLIANCE_LEVELS = {
  FULLY: {
    threshold: 90,
    label: 'Fully compliant',
    description: 'Meets all critical accessibility requirements',
  },
  LARGELY: {
    threshold: 80,
    label: 'Largely compliant',
    description: 'Meets most accessibility requirements with minor issues',
  },
  SUBSTANTIALLY: {
    threshold: 65,
    label: 'Substantially compliant',
    description: 'Meets basic accessibility requirements but needs improvement',
  },
  PARTIALLY: {
    threshold: 50,
    label: 'Partially compliant',
    description: 'Has significant accessibility issues that need addressing',
  },
  NOT: {
    threshold: 0,
    label: 'Not compliant',
    description: 'Has major accessibility issues that prevent access',
  },
};

export default {
  BITV_CATEGORIES,
  SEVERITY_LEVELS,
  TEST_STANDARDS,
  ERROR_POINTS,
  COMPLIANCE_LEVELS,
};
