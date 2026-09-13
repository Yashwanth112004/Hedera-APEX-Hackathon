/**
 * ==============================================================================
 * AI CLINICAL DRUG-DRUG & ALLERGY INTERACTION ENGINE
 * ==============================================================================
 * Rule-based AI Clinical validation engine that audits prescriptions,
 * patient allergy profiles, and active medications to prevent adverse drug events.
 */

// Known clinical contraindications database
const DRUG_INTERACTIONS = [
  {
    drugA: 'amlodipine',
    drugB: 'simvastatin',
    severity: 'High',
    description: 'Amlodipine increases systemic exposure to Simvastatin, increasing the risk of myopathy and rhabdomyolysis.',
    recommendation: 'Cap Simvastatin dose at 20mg daily or consider Rosuvastatin/Atorvastatin.'
  },
  {
    drugA: 'warfarin',
    drugB: 'aspirin',
    severity: 'Critical',
    description: 'Synergistic antithrombotic and anticoagulant effects markedly elevate major hemorrhage and gastrointestinal bleeding risks.',
    recommendation: 'Avoid combination unless indicated for mechanical heart valves with tight INR monitoring.'
  },
  {
    drugA: 'metformin',
    drugB: 'iodinated contrast',
    severity: 'High',
    description: 'Intravenous iodinated radiocontrast can precipitate acute renal impairment and lactic acidosis with Metformin.',
    recommendation: 'Withhold Metformin at time of radiologic procedure and resume 48h after confirming normal renal function.'
  },
  {
    drugA: 'sildenafil',
    drugB: 'nitroglycerin',
    severity: 'Critical',
    description: 'Potentiation of nitric oxide-mediated vasodilation results in profound, potentially fatal systemic hypotension.',
    recommendation: 'Strictly contraindicated. Do not administer nitrates within 24 hours of sildenafil.'
  },
  {
    drugA: 'lisinopril',
    drugB: 'spironolactone',
    severity: 'Moderate',
    description: 'Combined renin-angiotensin-aldosterone blockade increases risk of severe hyperkalemia.',
    recommendation: 'Monitor serum potassium and creatinine within 1-2 weeks of initiation.'
  },
  {
    drugA: 'ciprofloxacin',
    drugB: 'theophylline',
    severity: 'Moderate',
    description: 'CYP1A2 inhibition by Ciprofloxacin leads to elevated toxic theophylline serum concentrations.',
    recommendation: 'Reduce theophylline dose by 50% or choose an alternative antibiotic (e.g. Azithromycin).'
  },
  {
    drugA: 'methotrexate',
    drugB: 'ibuprofen',
    severity: 'High',
    description: 'NSAIDs reduce renal methotrexate clearance, elevating systemic toxicity (bone marrow suppression, nephrotoxicity).',
    recommendation: 'Avoid NSAIDs; use paracetamol/acetaminophen for pain relief.'
  }
];

// Common drug allergy cross-sensitivities
const ALLERGY_CROSS_REACTIONS = [
  {
    allergy: 'penicillin',
    drugKeywords: ['amoxicillin', 'ampicillin', 'augmentin', 'penicillin', 'piperacillin'],
    severity: 'Critical',
    description: 'Patient has documented Penicillin allergy. Prescribed medication is a beta-lactam with high cross-reactivity.'
  },
  {
    allergy: 'sulfa',
    drugKeywords: ['bactrim', 'sulfamethoxazole', 'septra', 'cotrimoxazole'],
    severity: 'High',
    description: 'Patient has documented Sulfonamide allergy. Risk of Stevens-Johnson syndrome or anaphylaxis.'
  },
  {
    allergy: 'nsaid',
    drugKeywords: ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'ketorolac'],
    severity: 'High',
    description: 'Patient has documented NSAID hypersensitivity (bronchospasm/urticaria risk).'
  }
];

/**
 * Checks for drug-drug interactions between a new medicine and existing patient medications
 */
export const checkDrugInteractions = (newMedicine, existingMedications = []) => {
  if (!newMedicine) return { hasInteraction: false, interactions: [] };
  
  const cleanNew = newMedicine.toLowerCase().trim();
  const interactions = [];

  const medsToCheck = Array.isArray(existingMedications) 
    ? existingMedications 
    : (typeof existingMedications === 'string' ? existingMedications.split(',') : []);

  for (const existing of medsToCheck) {
    const cleanExisting = (typeof existing === 'string' ? existing : existing.name || '').toLowerCase().trim();
    if (!cleanExisting) continue;

    for (const rule of DRUG_INTERACTIONS) {
      const match1 = cleanNew.includes(rule.drugA) && cleanExisting.includes(rule.drugB);
      const match2 = cleanNew.includes(rule.drugB) && cleanExisting.includes(rule.drugA);

      if (match1 || match2) {
        interactions.push({
          drugA: rule.drugA.toUpperCase(),
          drugB: rule.drugB.toUpperCase(),
          severity: rule.severity,
          description: rule.description,
          recommendation: rule.recommendation
        });
      }
    }
  }

  return {
    hasInteraction: interactions.length > 0,
    interactions,
    highestSeverity: interactions.some(i => i.severity === 'Critical') ? 'Critical' 
                   : interactions.some(i => i.severity === 'High') ? 'High' 
                   : interactions.some(i => i.severity === 'Moderate') ? 'Moderate' 
                   : 'Safe'
  };
};

/**
 * Checks for allergy contraindications against patient known allergies
 */
export const checkAllergyInteractions = (newMedicine, patientAllergies = []) => {
  if (!newMedicine) return { hasAllergyRisk: false, alerts: [] };
  
  const cleanNew = newMedicine.toLowerCase().trim();
  const alerts = [];

  const allergiesList = Array.isArray(patientAllergies)
    ? patientAllergies
    : (typeof patientAllergies === 'string' ? patientAllergies.split(',') : []);

  for (const allergy of allergiesList) {
    const cleanAllergy = (typeof allergy === 'string' ? allergy : '').toLowerCase().trim();
    if (!cleanAllergy || cleanAllergy === 'none' || cleanAllergy === 'nil') continue;

    for (const rule of ALLERGY_CROSS_REACTIONS) {
      if (cleanAllergy.includes(rule.allergy)) {
        const matchesDrug = rule.drugKeywords.some(keyword => cleanNew.includes(keyword));
        if (matchesDrug) {
          alerts.push({
            allergy: rule.allergy.toUpperCase(),
            drug: newMedicine,
            severity: rule.severity,
            description: rule.description
          });
        }
      }
    }
  }

  return {
    hasAllergyRisk: alerts.length > 0,
    alerts
  };
};

/**
 * Full AI Prescription Safety Audit
 */
export const auditPrescriptionSafety = (medicineName, patientMeds = [], patientAllergies = []) => {
  const drugCheck = checkDrugInteractions(medicineName, patientMeds);
  const allergyCheck = checkAllergyInteractions(medicineName, patientAllergies);

  const isSafe = !drugCheck.hasInteraction && !allergyCheck.hasAllergyRisk;
  const overallSeverity = drugCheck.highestSeverity === 'Critical' || allergyCheck.alerts.some(a => a.severity === 'Critical')
    ? 'Critical'
    : (drugCheck.highestSeverity === 'High' || allergyCheck.alerts.some(a => a.severity === 'High'))
      ? 'High'
      : (drugCheck.highestSeverity === 'Moderate')
        ? 'Moderate'
        : 'Safe';

  return {
    isSafe,
    overallSeverity,
    drugInteractions: drugCheck.interactions,
    allergyAlerts: allergyCheck.alerts,
    timestamp: new Date().toISOString()
  };
};
