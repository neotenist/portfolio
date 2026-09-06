document.addEventListener('DOMContentLoaded', function () {
  var preview = document.getElementById('work-hover-preview');
  var previewBox = document.getElementById('work-hover-preview-box');
  var previewImg = document.getElementById('work-hover-preview-img');
  var links = document.querySelectorAll('.work-list a[data-preview]');
  if (!preview || !links.length) return;

  var mouseX = 0, mouseY = 0;

  function moveTo(x, y) {
    preview.style.transform = 'translate3d(' + (x + 24) + 'px, ' + (y - 125) + 'px, 0)';
  }

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    moveTo(mouseX, mouseY);
  });

  links.forEach(function (link) {
    link.addEventListener('mouseenter', function () {
      previewImg.src = link.getAttribute('data-preview');
      previewBox.classList.add('is-visible');
    });
    link.addEventListener('mouseleave', function () {
      previewBox.classList.remove('is-visible');
    });
  });
});
