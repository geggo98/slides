<script setup lang="ts">
import QuizApp from "@shared/quiz/QuizApp.vue";
import quizData from "./quiz-questions.json";
import type { Quiz } from "@shared/quiz/lib/types";

const quiz = quizData as unknown as Quiz;
</script>

<template>
  <QuizApp :quiz="quiz" />
</template>
