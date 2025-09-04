module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-max-length': [2, 'always', 300],
    'body-max-line-length': [2, 'always', 300],
    'header-max-length': [2, 'always', 300],
  },
};
