// ✏️ 여기만 고치면 됩니다.
window.WEDDING = {
  groom: '문용권',            // 신랑 이름 (캐릭터 이름표에 표시)
  bride: '정유진',            // 신부 이름
  date: '2026. 11. 29',     // 예식 날짜
  // Google Apps Script 웹앱 URL (README의 '백엔드 연결' 참고).
  // 비워두면 '체험 모드'로 동작: 사진/방명록이 이 기기 브라우저에만 저장됩니다.
  api: 'https://script.google.com/macros/s/AKfycbxVNWRtXHOh8-ir43k53uXlnjrVTBGqarqxcIkR2x4W7xckj8njAVVZYmBtkTwGArzf/exec',
  // 업로드 전 사진 긴 변 최대 픽셀. 0 = 원본 그대로 업로드(용량 큼, 식장 LTE에서 느릴 수 있음)
  maxSide: 2560,
};
