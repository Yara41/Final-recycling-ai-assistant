// The sorting game: eight real items, four standard bins, ten points per right answer.
const item = (id, bin, ar, en, ruleAr, ruleEn) => ({ id, bin, image: `/items/${id}.webp`, name: { ar, en }, rule: { ar: ruleAr, en: ruleEn } });

export const ITEMS = [
  item('bottle', 'plastic', 'عبوة ماء بلاستيكية', 'Plastic water bottle', 'العبوات البلاستيكية النظيفة تُعاد تدويرها في حاوية البلاستيك.', 'Clean plastic bottles are recycled in the plastic bin.'),
  item('chips', 'general', 'كيس شيبس', 'Crisp packet', 'أكياس الشيبس مصنوعة من طبقات مختلطة ولا يمكن إعادة تدويرها.', 'Crisp packets are mixed layers and cannot be recycled.'),
  item('can', 'metal', 'علبة مشروب معدنية', 'Drink can', 'علب المشروبات المعدنية مكانها حاوية المعادن.', 'Drink cans go in the metal bin.'),
  item('pizza', 'general', 'علبة بيتزا دهنية', 'Greasy pizza box', 'الكرتون الملوّث بالدهون لا يُعاد تدويره.', 'Cardboard soaked in grease cannot be recycled.'),
  item('paper', 'paper', 'ورقة مستعملة', 'Used sheet of paper', 'الورق النظيف والجاف يُعاد تدويره.', 'Clean, dry paper is recycled.'),
  item('tissue', 'general', 'منديل مستعمل', 'Used tissue', 'المناديل المستعملة تذهب إلى النفايات العامة.', 'Used tissues go in general waste.'),
  item('cardboard', 'paper', 'كرتونة نظيفة', 'Clean cardboard', 'الكرتون النظيف يوضع مع الورق بعد طيّه.', 'Flatten clean cardboard and put it with paper.'),
  item('banana', 'general', 'قشر موز', 'Banana peel', 'بقايا الطعام تذهب إلى النفايات العامة في هذه الجامعة.', 'Food scraps go in general waste at this university.'),
];

export const initialState = () => ({ round: 0, score: 0, right: 0 });
export const isOver = (state) => state.round >= ITEMS.length;

export function answer(state, binId) {
  if (isOver(state)) return { state, correct: false, points: 0, rightBin: null };
  const current = ITEMS[state.round];
  const correct = binId === current.bin;
  const points = correct ? 10 : 0;
  return {
    state: { round: state.round + 1, score: state.score + points, right: state.right + (correct ? 1 : 0) },
    correct,
    points,
    rightBin: current.bin,
  };
}
