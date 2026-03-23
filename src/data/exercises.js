export const EXERCISES = {
  push: [
    { name: 'Développé couché', muscles: 'Pectoraux · Triceps · Épaules' },
    { name: 'Développé incliné', muscles: 'Pectoraux supérieurs · Triceps' },
    { name: 'Développé décliné', muscles: 'Pectoraux inférieurs · Triceps' },
    { name: 'Développé militaire', muscles: 'Épaules · Triceps' },
    { name: 'Arnold Press', muscles: 'Épaules (3 faisceaux)' },
    { name: 'Dips', muscles: 'Triceps · Pectoraux' },
    { name: 'Pompes', muscles: 'Pectoraux · Triceps · Épaules' },
    { name: 'Pompes bras écartés', muscles: 'Pectoraux (extérieur) · Épaules' },
    { name: 'Pompes corps en avant', muscles: 'Pectoraux · Épaules antérieures' },
    { name: 'Pompes pieds en hauteur', muscles: 'Pectoraux supérieurs · Épaules' },
    { name: 'Pompes mains collées', muscles: 'Triceps · Pectoraux (intérieur)' },
    { name: 'Écartés haltères', muscles: 'Pectoraux (étirement)' },
    { name: 'Élévations latérales', muscles: 'Épaules (médian)' },
    { name: 'Élévations frontales', muscles: 'Épaules (antérieur)' },
    { name: 'Triceps poulie haute', muscles: 'Triceps (chef long)' },
    { name: 'Skull Crushers', muscles: 'Triceps' },
    { name: 'Extension triceps overhead', muscles: 'Triceps (chef long)' },
    { name: 'Machine pectoraux', muscles: 'Pectoraux' },
  ],
  pull: [
    { name: 'Tractions pronation', muscles: 'Dorsaux · Biceps' },
    { name: 'Tractions supination', muscles: 'Dorsaux · Biceps (pic)' },
    { name: 'Rowing barre', muscles: 'Dos · Trapèzes · Biceps' },
    { name: 'Rowing haltère', muscles: 'Dos · Biceps' },
    { name: 'Tirage horizontal poulie', muscles: 'Dos · Biceps' },
    { name: 'Tirage vertical (LPD)', muscles: 'Dorsaux · Biceps' },
    { name: 'Face Pull', muscles: 'Épaules postérieures · Trapèzes' },
    { name: 'Curl barre', muscles: 'Biceps' },
    { name: 'Curl haltères alterné', muscles: 'Biceps' },
    { name: 'Curl marteau', muscles: 'Biceps · Brachial · Avant-bras' },
    { name: 'Curl pupitre', muscles: 'Biceps (contraction max)' },
    { name: 'Rowing T-bar', muscles: 'Dos épais · Trapèzes' },
    { name: 'Shrugs', muscles: 'Trapèzes supérieurs' },
    { name: 'Pull-over poulie', muscles: 'Dorsaux · Grand dentelé' },
  ],
  legs: [
    { name: 'Squat barre', muscles: 'Quadriceps · Fessiers · Ischio' },
    { name: 'Goblet Squat', muscles: 'Quadriceps · Fessiers' },
    { name: 'Hack Squat', muscles: 'Quadriceps' },
    { name: 'Presse à cuisses', muscles: 'Quadriceps · Fessiers · Ischio' },
    { name: 'Fentes marchées', muscles: 'Quadriceps · Fessiers' },
    { name: 'Fentes bulgares', muscles: 'Quadriceps · Fessiers' },
    { name: 'Leg Extension', muscles: 'Quadriceps (isolation)' },
    { name: 'Leg Curl couché', muscles: 'Ischio-jambiers' },
    { name: 'Leg Curl assis', muscles: 'Ischio-jambiers' },
    { name: 'Soulevé de terre', muscles: 'Chaîne postérieure complète' },
    { name: 'Soulevé de terre roumain', muscles: 'Ischio-jambiers · Fessiers' },
    { name: 'Hip Thrust', muscles: 'Fessiers (pic contraction)' },
    { name: 'Mollets debout', muscles: 'Gastrocnémiens' },
    { name: 'Mollets assis', muscles: 'Soléaire' },
  ],
}

// All exercises flat list
export const ALL_EXERCISES = [
  ...EXERCISES.push.map(e => ({ ...e, type: 'push' })),
  ...EXERCISES.pull.map(e => ({ ...e, type: 'pull' })),
  ...EXERCISES.legs.map(e => ({ ...e, type: 'legs' })),
]

export const TYPE_LABELS = { push: 'Push', pull: 'Pull', legs: 'Legs' }
export const TYPE_COLORS = {
  push: 'text-orange-400 bg-orange-500/20',
  pull: 'text-blue-400 bg-blue-500/20',
  legs: 'text-green-400 bg-green-500/20',
}
