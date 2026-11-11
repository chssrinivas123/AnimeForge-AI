def build_story_outline(
    prompt: str,
    genre: str,
    art_style: str,
    episode_duration: int,
    character_count: int,
    tone: str = "Dramatic",
) -> list[dict[str, str]]:
    cleaned_prompt = prompt.strip()
    title_anchor = cleaned_prompt.split()[:6]
    title = " ".join(title_anchor).title() if title_anchor else "New Story"

    return [
        {
            "title": "Opening Hook",
            "description": f"{title} begins with a cinematic reveal of the world and the central conflict in a {genre.lower()} setting, with a {tone.lower()} tone.",
        },
        {
            "title": "Character Arc",
            "description": f"{character_count} core characters navigate loyalty, identity, and sacrifice in a {tone.lower()} tone while the art direction stays {art_style.lower()}.",
        },
        {
            "title": "Crescendo",
            "description": f"At {episode_duration} minutes, the story locks into a high-stakes battle that resolves the emotional threads and leads to a hopeful or tragic finale.",
        },
        {
            "title": "Visual Breakdown",
            "description": "Scene beats are staged for dynamic camera motion, layered VFX, and emotionally grounded anime dialogue pacing.",
        },
    ]
