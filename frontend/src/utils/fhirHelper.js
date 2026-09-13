/**
 * ==============================================================================
 * HL7 FHIR R4 STANDARD RESOURCE GENERATOR & BUNDLE EXPORT HELPER
 * ==============================================================================
 * Formats EMRs, Lab Reports, Prescriptions, Encounters, and Claims into
 * strict HL7 FHIR R4 standard JSON resources for cross-hospital interoperability.
 */

/**
 * Creates an HL7 FHIR R4 Patient resource
 */
export const createFHIRPatient = ({ id, name, gender = 'unknown', birthDate = '1990-01-01', telecom = [], address = [], identifier = [] }) => {
  return {
    resourceType: 'Patient',
    id: id || `patient-${Date.now()}`,
    identifier: [
      {
        system: 'https://ojasraksha.health/identifiers/short-id',
        value: id
      },
      ...identifier
    ],
    active: true,
    name: [
      {
        use: 'official',
        text: name || 'Anonymous Patient'
      }
    ],
    gender,
    birthDate,
    telecom,
    address
  };
};

/**
 * Creates an HL7 FHIR R4 Condition resource (ICD-10 coded)
 */
export const createFHIRCondition = ({ patientId, icdCode, icdTitle, clinicalStatus = 'active', verificationStatus = 'confirmed', recordedDate = new Date().toISOString() }) => {
  return {
    resourceType: 'Condition',
    id: `condition-${Date.now()}`,
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: clinicalStatus }]
    },
    verificationStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: verificationStatus }]
    },
    category: [
      {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis', display: 'Encounter Diagnosis' }]
      }
    ],
    code: {
      coding: [
        {
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: icdCode || 'R07.9',
          display: icdTitle || 'Chest pain, unspecified'
        }
      ],
      text: icdTitle
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    recordedDate
  };
};

/**
 * Creates an HL7 FHIR R4 DiagnosticReport resource (for Lab tests)
 */
export const createFHIRDiagnosticReport = ({ id, patientId, performerName, testName, category = 'LAB', status = 'final', issued = new Date().toISOString(), resultText = '', conclusion = '', ipfsCid = '' }) => {
  return {
    resourceType: 'DiagnosticReport',
    id: id || `diag-${Date.now()}`,
    identifier: [
      {
        system: 'https://ojasraksha.health/ipfs-cid',
        value: ipfsCid
      }
    ],
    status,
    category: [
      {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: category, display: 'Laboratory' }]
      }
    ],
    code: {
      text: testName || 'Diagnostic Lab Investigation'
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    performer: [
      {
        display: performerName || 'Diagnostic Laboratory'
      }
    ],
    issued,
    conclusion: conclusion || resultText,
    presentedForm: ipfsCid ? [{ contentType: 'application/json', url: `ipfs://${ipfsCid}` }] : []
  };
};

/**
 * Creates an HL7 FHIR R4 MedicationRequest resource (Prescription)
 */
export const createFHIRMedicationRequest = ({ id, patientId, requesterName, medicineName, dosageInstruction, duration, intent = 'order', status = 'active', icdCode = '' }) => {
  return {
    resourceType: 'MedicationRequest',
    id: id || `medrx-${Date.now()}`,
    status,
    intent,
    medicationCodeableConcept: {
      text: medicineName
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    requester: {
      display: requesterName || 'Attending Physician'
    },
    reasonCode: icdCode ? [
      {
        coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: icdCode }]
      }
    ] : [],
    dosageInstruction: [
      {
        text: `${dosageInstruction || 'As directed'} for ${duration || '7 days'}`
      }
    ],
    authoredOn: new Date().toISOString()
  };
};

/**
 * Creates an HL7 FHIR R4 Bundle (Collection of resources for hospital export or transfer)
 */
export const createFHIRBundle = ({ bundleId, patientId, resources = [] }) => {
  return {
    resourceType: 'Bundle',
    id: bundleId || `fhir-bundle-${Date.now()}`,
    type: 'document',
    timestamp: new Date().toISOString(),
    entry: resources.map(resource => ({
      fullUrl: `urn:uuid:${resource.id || Math.random().toString(36).substring(2, 10)}`,
      resource
    }))
  };
};
