import json
import os
from typing import Dict, List, Optional
from app.models.schemas import Scenario

class ScenarioRepository:
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            # Default to backend/app/scenarios
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.data_dir = os.path.join(base_dir, "scenarios")
        else:
            self.data_dir = data_dir
        self._cache: Dict[str, Scenario] = {}
        self.load_all()

    def load_all(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir, exist_ok=True)
            return

        for filename in os.listdir(self.data_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self.data_dir, filename)
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    scenario = Scenario(**data)
                    self._cache[scenario.id] = scenario

    def list_scenarios(self) -> List[Dict]:
        return [
            {
                "id": s.id,
                "title": s.title,
                "description": s.description,
                "severity": s.severity,
                "event_count": len(s.events),
                "entity_count": len(s.entities),
            }
            for s in self._cache.values()
        ]

    def get_scenario(self, scenario_id: str) -> Optional[Scenario]:
        return self._cache.get(scenario_id)

    def add_scenario(self, scenario: Scenario):
        self._cache[scenario.id] = scenario
