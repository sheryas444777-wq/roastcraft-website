window.onload = function(){
  const popup = document.getElementById("popup");

  if(popup){
    setTimeout(function(){
      popup.style.display = "block";
    }, 2000);

    generateCaptcha();
  }

  if(document.querySelector(".slide") && document.querySelector(".dot")){
    startSlideshow();
  }

}

function closePopup(){
  const popup = document.getElementById("popup");
  if(popup){
    popup.style.display = "none";
  }
}


let currentSlide = 0;
let slideshowTimer;
let captchaAnswer = null;

function showSlide(index){
  const slides = document.querySelectorAll(".slide");
  const dots = document.querySelectorAll(".dot");

  if(!slides.length || !dots.length){
    return;
  }

  if(index >= slides.length) index = 0;
  if(index < 0) index = slides.length - 1;

  slides.forEach(s => s.classList.remove("active"));
  dots.forEach(d => d.classList.remove("active"));

  slides[index].classList.add("active");
  dots[index].classList.add("active");

  currentSlide = index;
}

function changeSlide(direction){
  showSlide(currentSlide + direction);
  resetTimer();
}

function goToSlide(index){
  showSlide(index);
  resetTimer();
}

function startSlideshow(){
  if(!document.querySelector(".slide") || !document.querySelector(".dot")){
    return;
  }

  slideshowTimer = setInterval(function(){
    showSlide(currentSlide + 1);
  }, 3500);
}

function resetTimer(){
  clearInterval(slideshowTimer);
  startSlideshow();
}

function generateCaptcha(){
  const firstNumber = Math.floor(Math.random() * 9) + 1;
  const secondNumber = Math.floor(Math.random() * 9) + 1;
  captchaAnswer = firstNumber + secondNumber;

  const captchaQuestion = document.getElementById("captcha-question");
  if(captchaQuestion){
    captchaQuestion.textContent = firstNumber + " + " + secondNumber + " = ?";
  }
}

const observer = new IntersectionObserver(function(entries){
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('animate');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.why-card, .featured-card, .coffee-card, .offer-card, .promo-card, .why-us, .featured, .map-section, .coffee-section, .page-header').forEach(el => {
  observer.observe(el);
});
function popupRegister(){
  const emailField = document.getElementById('popup-email');
  const passwordField = document.getElementById('popup-password');
  const confirmPasswordField = document.getElementById('popup-confirm-password');
  const captchaField = document.getElementById('popup-captcha');

  if(!emailField || !passwordField || !confirmPasswordField || !captchaField){
    return;
  }

  const email = emailField.value.trim();
  const password = passwordField.value;
  const confirmPassword = confirmPasswordField.value;
  const captchaInput = captchaField.value.trim();

  if(!email){
    alert('Please enter your email address.');
    return;
  }

  if(!password){
    alert('Please enter a new password.');
    return;
  }

  if(password.length < 6){
    alert('Password must be at least 6 characters long.');
    return;
  }

  if(confirmPassword !== password){
    alert('Passwords do not match.');
    return;
  }

  if(captchaInput === '' || Number(captchaInput) !== captchaAnswer){
    alert('Captcha answer is incorrect. Please try again.');
    generateCaptcha();
    captchaField.value = '';
    return;
  }

  alert('Thanks! Your account is ready and your 15% discount code is WELCOME15');
  closePopup();
}
