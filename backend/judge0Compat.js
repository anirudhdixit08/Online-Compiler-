export const JUDGE0_STATUSES = [
  { id: 1, description: "In Queue" },
  { id: 2, description: "Processing" },
  { id: 3, description: "Accepted" },
  { id: 4, description: "Wrong Answer" },
  { id: 5, description: "Time Limit Exceeded" },
  { id: 6, description: "Compilation Error" },
  { id: 7, description: "Runtime Error (SIGSEGV)" },
  { id: 8, description: "Runtime Error (SIGXFSZ)" },
  { id: 9, description: "Runtime Error (SIGFPE)" },
  { id: 10, description: "Runtime Error (SIGABRT)" },
  { id: 11, description: "Runtime Error (NZEC)" },
  { id: 12, description: "Runtime Error (Other)" },
  { id: 13, description: "Internal Error" },
  { id: 14, description: "Exec Format Error" },
];

export const SUPPORTED_LANGUAGES = [
  { id: 48, name: "C (GCC 7.4.0)", key: "c", is_archived: false },
  { id: 49, name: "C (GCC 8.3.0)", key: "c", is_archived: false },
  { id: 50, name: "C (GCC 9.2.0)", key: "c", is_archived: false },
  { id: 52, name: "C++ (GCC 7.4.0)", key: "cpp", is_archived: false },
  { id: 53, name: "C++ (GCC 8.3.0)", key: "cpp", is_archived: false },
  { id: 54, name: "C++ (GCC 9.2.0)", key: "cpp", is_archived: false },
  { id: 62, name: "Java (OpenJDK 13.0.1)", key: "java", is_archived: false },
  { id: 63, name: "JavaScript (Node.js 12.14.0)", key: "js", is_archived: false },
  { id: 71, name: "Python (3.8.1)", key: "py", is_archived: false },
  { id: 109, name: "Python (3.x)", key: "py", is_archived: false },
];

export const LANGUAGE_ALIASES = {
  c: SUPPORTED_LANGUAGES.find((language) => language.key === "c"),
  cpp: SUPPORTED_LANGUAGES.find((language) => language.key === "cpp"),
  java: SUPPORTED_LANGUAGES.find((language) => language.key === "java"),
  js: SUPPORTED_LANGUAGES.find((language) => language.key === "js"),
  py: SUPPORTED_LANGUAGES.find((language) => language.key === "py"),
  python: SUPPORTED_LANGUAGES.find((language) => language.key === "py"),
};

export const getStatusById = (id) =>
  JUDGE0_STATUSES.find((status) => status.id === id) || JUDGE0_STATUSES[12];

export const getLanguageById = (id) =>
  SUPPORTED_LANGUAGES.find((language) => language.id === Number(id));

export const getLanguageByKey = (key) => LANGUAGE_ALIASES[key];

export const decodeMaybeBase64 = (value, shouldDecode) => {
  if (value === undefined || value === null) return value;
  if (!shouldDecode) return value;
  return Buffer.from(String(value), "base64").toString("utf8");
};

export const encodeMaybeBase64 = (value, shouldEncode) => {
  if (value === undefined || value === null) return null;
  if (!shouldEncode) return value;
  return Buffer.from(String(value), "utf8").toString("base64");
};

export const isTruthyQuery = (value) =>
  value === true || value === "true" || value === "1";

export const stripAnsi = (value) => {
  if (value === undefined || value === null) return value;
  return String(value).replace(
    // eslint-disable-next-line no-control-regex
    /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
};

export const normalizeOutput = (value) =>
  value === undefined || value === null
    ? ""
    : stripAnsi(value).replace(/\s+$/g, "");

export const validateSubmissionPayload = (submission) => {
  const errors = {};

  if (
    !submission ||
    submission.source_code === undefined ||
    submission.source_code === null ||
    submission.source_code === ""
  ) {
    errors.source_code = ["can't be blank"];
  }

  if (submission?.language_id === undefined || submission?.language_id === null) {
    errors.language_id = ["can't be blank"];
  } else if (!getLanguageById(submission.language_id)) {
    errors.language_id = [
      `language with id ${submission.language_id} doesn't exist`,
    ];
  }

  return errors;
};

export const hasValidationErrors = (errors) => Object.keys(errors).length > 0;

export const pickFields = (submission, fields) => {
  if (!fields) return submission;
  if (fields.trim() === "*") return submission;

  return fields.split(",").reduce((selected, rawField) => {
    const field = rawField.trim();
    if (!field) return selected;
    if (Object.prototype.hasOwnProperty.call(submission, field)) {
      selected[field] = submission[field];
    }
    return selected;
  }, {});
};
