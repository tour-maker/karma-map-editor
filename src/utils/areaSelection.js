// How the Primary / Secondary location pair of the plot editor reacts to a change.
//  - Choosing a Secondary keeps the Primary that is already selected: the Secondary options
//    belong to it. (Re-deriving the Primary from the sub-area name made it jump to the
//    sub-area itself, e.g. "Ast" under "Kosamba" turned the Primary into "Ast".) A Primary
//    is only guessed when none has been chosen yet.
//  - Choosing a Primary keeps the current Secondary if it belongs to that Primary; otherwise
//    clears it when the Primary has sub-areas to choose from, or places the plot directly
//    under the Primary (location = Primary) when it has none.
// `subsFor(parent)` lists a Primary's sub-areas; `deriveParent(location)` guesses a Primary.
export function applyAreaChange(prev, field, value, { subsFor, deriveParent }) {
  const next = { ...prev, [field]: value };
  if (field === 'location') {
    next.parentLocation = prev.parentLocation || deriveParent(value);
  }
  if (field === 'parentLocation') {
    const subs = subsFor(value) || [];
    const keepSub = subs.some(sub => String(sub).toLowerCase() === String(prev.location || '').toLowerCase());
    next.location = keepSub ? prev.location : (subs.length > 0 ? '' : (value || ''));
  }
  return next;
}
