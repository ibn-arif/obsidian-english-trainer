# Публикация English Trainer в каталоге Obsidian

Всё подготовлено локально. Ниже — шаги, которые выполняются **только по вашему решению**: они создают публичный репозиторий на GitHub от вашего имени.

## 0. Перед публикацией (по желанию)
- Добавьте 1–2 скриншота в папку `images/` и вставьте их в `README.md` (`![Quiz](./images/quiz.png)`). Скриншоты показываются на странице плагина в каталоге.
- Проверьте поле `author` в `manifest.json` (сейчас `ibn-arif`).

## 1. Публичный репозиторий на GitHub
```bash
cd ~/Projects/obsidian-english-trainer
gh repo create ibn-arif/obsidian-english-trainer --public --source . --remote origin --push
```

## 2. Релиз 0.1.0
Тег должен совпадать с `version` в `manifest.json`.
```bash
git tag 0.1.0
git push origin 0.1.0
```
GitHub Actions соберёт плагин, прогонит тесты и линтер и создаст **черновик** релиза с файлами `main.js`, `manifest.json`, `styles.css`.
Откройте https://github.com/ibn-arif/obsidian-english-trainer/releases, проверьте черновик и нажмите **Publish release**.

Без GitHub Actions релиз можно сделать вручную из готовых файлов:
```bash
gh release create 0.1.0 release/0.1.0/main.js release/0.1.0/manifest.json release/0.1.0/styles.css --title 0.1.0 --notes "First release"
```

## 3. Заявка в каталог
1. Откройте https://community.obsidian.md и войдите аккаунтом Obsidian.
2. Привяжите GitHub-аккаунт в профиле (так каталог проверит, что репозиторий ваш).
3. Добавьте плагин (Add a plugin) и укажите репозиторий `ibn-arif/obsidian-english-trainer`.
4. Каталог прочитает `manifest.json` из ветки `main` и файлы релиза `0.1.0`.

## 4. Замечания автоматической проверки
Каталог проверяет код автоматически и показывает, что исправить. Исправления выпускаются новым релизом:
```bash
npm version 0.1.1      # обновит manifest.json и versions.json и создаст тег
git push && git push --tags
```

## Что уже проверено
- `eslint-plugin-obsidianmd`: 0 ошибок, 1 предупреждение (декларативные настройки Obsidian 1.13+, несовместимы с minAppVersion 1.9).
- 79 модульных тестов; чистая сборка из клона (`npm ci && npm test && npm run lint && npm run build`).
- ID `english-trainer` и имя «English Trainer» свободны в каталоге (проверено 30.10.2026).
- README раскрывает использование сети и лицензии источников данных (требование правил каталога).
