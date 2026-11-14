// Metro turns `.css` imports into styles; TypeScript only has to know that they
// are modules. These are normally declared by the types Expo generates into
// `.expo/types` when the dev server runs, which a fresh checkout (and CI) lacks.
declare module '*.css';
