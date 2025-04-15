// src/constants.js

/**
 * BITV/WCAG Categories
 * Structured according to WCAG 2.1 principles
 */
const BITV_CATEGORIES = {
  PERCEIVABLE: {
    id: 'perceivable',
    description: 'Information and user interface components must be presentable to users in ways they can perceive',
  },
  OPERABLE: {
    id: 'operable',
    description: 'User interface components and navigation must be operable',
  },
  UNDERSTANDABLE: {
    id: 'understandable',
    description: 'Information and the operation of user interface must be understandable',
  },
  ROBUST: {
    id: 'robust',
    description: 'Content must be robust enough to be interpreted by a wide variety of user agents',
  },
};

/**
 * Severity Levels with Impact Description
 * Based on WCAG 2.1 and EN 301 549 requirements
 */
const SEVERITY_LEVELS = {
  CRITICAL: {
    value: 4,
    description: 'Prevents access for certain user groups',
    impact: 'Makes content or functionality completely inaccessible to some users',
  },
  HIGH: {
    value: 3,
    description: 'Significantly impairs accessibility',
    impact: 'Severely affects usability but content remains technically accessible',
  },
  MEDIUM: {
    value: 2,
    description: 'Moderately affects accessibility',
    impact: 'Creates difficulties but content remains mostly usable',
  },
  LOW: {
    value: 1,
    description: 'Minor accessibility concerns',
    impact: 'Causes minor inconvenience or aesthetic issues',
  },
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

module.exports = {
  BITV_CATEGORIES,
  SEVERITY_LEVELS,
  TEST_STANDARDS,
  ERROR_POINTS,
  COMPLIANCE_LEVELS,
};
