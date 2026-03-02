// ui/pages/page.home.js
export function renderHome(root) {
  root.innerHTML = `
    <section class="homeHero">
      <div class="homeHeroCard">
        <div class="kicker">✨ 오늘도 한 걸음</div>
        <h1>오늘은 3분만, 중국어 해볼까요?</h1>
        <p>아이들은 즐겁게, 부모님/선생님은 커리큘럼을 쉽게 찾을 수 있도록 구성했어요.</p>

        <div class="ctaRow">
          <a class="btnPrimary" href="#/learn/today">시작 학습</a>
          <a class="btn" href="#/curriculum/catalog">커리큘럼 보기</a>
        </div>
      </div>
    </section>

    <section class="homeQuick">
      <div class="grid3">
        <a class="card" href="#/learn/today">
          <b>오늘의 학습</b>
          <div class="muted">마지막 수업 이어서</div>
        </a>

        <a class="card" href="#/curriculum/catalog">
          <b>课程目录（可查找）</b>
          <div class="muted">搜索/筛选/排序</div>
        </a>

        <a class="card" href="#/parent">
          <b>家长/老师专区</b>
          <div class="muted">进度/作业/通知</div>
        </a>
      </div>
    </section>
  `;
}
