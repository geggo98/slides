<script setup lang="ts">
/**
 * NullSafetyQuiz — talk-specific wrapper around the reusable QuizApp.
 *
 * Loads the deck's question pool from quiz-questions.json and mounts the
 * generic <QuizApp> after the end slide so audience members can self-test.
 * All quiz logic, persistence, accessibility and theming live in shared/quiz/.
 */
import QuizApp from "@shared/quiz/QuizApp.vue";
import quizData from "./quiz-questions.json";
import type { Quiz } from "@shared/quiz/lib/types";

const quiz = quizData as unknown as Quiz;
</script>

<template>
  <QuizApp :quiz="quiz" />
</template>
