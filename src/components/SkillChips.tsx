type SkillChipsProps = {
  skills: string[];
};

export default function SkillChips({ skills }: SkillChipsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {skills.map((skill) => (
        <span key={skill} className="skill-chip">
          {skill}
        </span>
      ))}
    </div>
  );
}
