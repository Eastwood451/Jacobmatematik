const assert=require('node:assert/strict');
const gcd=(a,b)=>{while(b)[a,b]=[b,a%b];return a;};
async function completeFinish(page, answer='yes') {
  assert.equal(await page.locator('[data-ff-stage="assess"]').count(),1);
  const n=Number(await page.locator('.ff-equation .fl-numerator').innerText());
  const d=Number(await page.locator('.ff-equation .fl-denominator').innerText());
  const g=gcd(n,d);
  await page.locator(`[data-ff-choice="${g>1?'reduce':'fine'}"]`).click();
  if(g>1) {
    await page.locator('[data-ff-choice="divideBoth"]').click();
    await page.locator(`[data-ff-divisor="${g}"]`).click();
    await page.locator('[data-ff-answer="numerator"]').fill(String(n/g));
    await page.locator('[data-ff-answer="denominator"]').fill(String(d/g));
    await page.locator('[data-ff-check]').click();
  }
  assert.equal(await page.locator('[data-ff-stage="ready"]').count(),1);
  await page.locator(`[data-ff-choice="${answer}"]`).click();
  assert.equal(await page.locator('[data-ff-stage="done"]').count(),1);
  return {n:n/g,d:d/g};
}
module.exports={completeFinish};
