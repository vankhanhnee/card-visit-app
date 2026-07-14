import React, { useEffect, useState } from 'react';
import { cardInnerHtml, fontFaceCss } from '../lib/card';

/**
 * Render 1 mat card dung ty le. Noi dung dung chung ham cardInnerHtml() voi luc
 * xuat PDF => WYSIWYG. Template co dinh nen day chi la lop hien thi, khong sua.
 */
export default function CardCanvas({ template, side, emp, qrMap, scale = 3 }) {
  const { cardW, cardH, radius, background } = template;

  // cardInnerHtml do be rong chu de tu thu nho co chu cho vua mot dong. Do luc
  // font chua nap xong se ra so sai (do bang font he thong), nen ve lai mot lan
  // khi font san sang.
  const [, setFontsReady] = useState(false);
  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, [template, emp]);

  return (
    // transform:scale khong chiem cho trong layout, nen wrapper phai giu dung
    // kich thuoc da scale de stage cuon/canh giua chinh xac.
    <div className="canvas-wrap" style={{ width: `${cardW * scale}mm`, height: `${cardH * scale}mm` }}>
      <style>{fontFaceCss(template, emp ? [emp] : [])}</style>
      <div
        className="card-canvas"
        style={{
          width: `${cardW}mm`,
          height: `${cardH}mm`,
          transform: `scale(${scale})`,
          background,
          borderRadius: `${radius}mm`,
        }}
        dangerouslySetInnerHTML={{ __html: cardInnerHtml(template, side, emp, qrMap) }}
      />
    </div>
  );
}
