// סכימת דוגמה: מתנע ישיר (DOL) למנוע תלת-פאזי עם פיקוד 230V והחזקה עצמית.
export function dolStarter() {
  const t = (id, name, side, potential = '') => ({ id, name, side, potential });
  return {
    needed: true,
    title: 'מתנע ישיר למנוע 5.5kW עם פיקוד 230V',
    notes: ['כיול מגן המנוע Q1 לזרם השלט של המנוע (כ-11A).'],
    components: [
      { id: 'X0', label: 'הזנה 400V', type: 'source', col: 0, row: 0, terminals: [t('L1', 'פאזה 1', 'right', 'L1'), t('L2', 'פאזה 2', 'right', 'L2'), t('L3', 'פאזה 3', 'right', 'L3'), t('N', 'אפס', 'right', 'N'), t('PE', 'הארקה', 'right', 'PE')] },
      { id: 'Q1', label: 'מגן מנוע GV2 9-14A', type: 'breaker', col: 1, row: 0, terminals: [t('1', 'L1 in', 'left', 'L1'), t('3', 'L2 in', 'left', 'L2'), t('5', 'L3 in', 'left', 'L3'), t('2', 'T1', 'right'), t('4', 'T2', 'right'), t('6', 'T3', 'right')] },
      { id: 'K1', label: 'מגען LC1D12 230VAC', type: 'contactor', col: 2, row: 0, terminals: [t('1', 'L1', 'left'), t('3', 'L2', 'left'), t('5', 'L3', 'left'), t('A1', 'סליל', 'left'), t('13', 'עזר NO', 'left'), t('2', 'T1', 'right'), t('4', 'T2', 'right'), t('6', 'T3', 'right'), t('A2', 'סליל', 'right', 'N'), t('14', 'עזר NO', 'right')] },
      { id: 'M1', label: 'מנוע 5.5kW', type: 'motor', col: 3, row: 0, terminals: [t('U', 'U1', 'left'), t('V', 'V1', 'left'), t('W', 'W1', 'left'), t('PE', 'גוף', 'left', 'PE')] },
      { id: 'F2', label: 'מבטח פיקוד 2A', type: 'fuse', col: 1, row: 1, terminals: [t('1', 'כניסה', 'left', 'L1'), t('2', 'יציאה', 'right')] },
      { id: 'S0', label: 'לחצן עצירה NC', type: 'button', col: 2, row: 1, terminals: [t('11', 'NC', 'left'), t('12', 'NC', 'right')] },
      { id: 'S1', label: 'לחצן הפעלה NO', type: 'button', col: 2, row: 2, terminals: [t('13', 'NO', 'left'), t('14', 'NO', 'right')] }
    ],
    wires: [
      { from: 'X0.L1', to: 'Q1.1', color: 'חום', section: '2.5', label: '1' },
      { from: 'X0.L2', to: 'Q1.3', color: 'שחור', section: '2.5', label: '2' },
      { from: 'X0.L3', to: 'Q1.5', color: 'אפור', section: '2.5', label: '3' },
      { from: 'Q1.2', to: 'K1.1', color: 'חום', section: '2.5', label: '4' },
      { from: 'Q1.4', to: 'K1.3', color: 'שחור', section: '2.5', label: '5' },
      { from: 'Q1.6', to: 'K1.5', color: 'אפור', section: '2.5', label: '6' },
      { from: 'K1.2', to: 'M1.U', color: 'חום', section: '2.5', label: '7' },
      { from: 'K1.4', to: 'M1.V', color: 'שחור', section: '2.5', label: '8' },
      { from: 'K1.6', to: 'M1.W', color: 'אפור', section: '2.5', label: '9' },
      { from: 'X0.PE', to: 'M1.PE', color: 'ירוק-צהוב', section: '2.5', label: 'PE' },
      { from: 'X0.L1', to: 'F2.1', color: 'חום', section: '1', label: '10' },
      { from: 'F2.2', to: 'S0.11', color: 'אדום', section: '1', label: '11' },
      { from: 'S0.12', to: 'S1.13', color: 'אדום', section: '1', label: '12' },
      { from: 'S1.14', to: 'K1.A1', color: 'אדום', section: '1', label: '13' },
      { from: 'S0.12', to: 'K1.13', color: 'אדום', section: '1', label: '12' },
      { from: 'K1.14', to: 'K1.A1', color: 'אדום', section: '1', label: '13' },
      { from: 'K1.A2', to: 'X0.N', color: 'כחול', section: '1', label: 'N' }
    ]
  };
}
