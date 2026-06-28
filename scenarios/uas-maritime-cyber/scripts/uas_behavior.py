class UasBehavior:
    def __init__(self, params):
        self.params = params
        self.last_recommendation_tick = -1
        self.last_comms_action_tick = -1

    def on_init(self, ctx):
        ctx.log("UAS behavior initialized")

    def on_tick(self, ctx, dt):
        sensor_conf = ctx.get("self.sensor.confidence")
        comms_health = ctx.get("blue_relay_1.comms.health")
        tick = ctx.tick()

        min_conf = self.params.get("min_sensor_confidence", 0.55)
        if sensor_conf is not None and sensor_conf < min_conf:
            ctx.emit_event(
                type="sensor_confidence_loss",
                label="Python detected low sensor confidence",
                confidence=0.8,
            )

            if tick - self.last_recommendation_tick > 120:
                ctx.propose_coa(
                    action="isolate_compromised_sensor_feed",
                    target=ctx.self_id(),
                    expected_mission_gain=0.19,
                    causal_confidence=0.82,
                    cost=0.03,
                    risk=0.05,
                    rationale="Python policy: sensor confidence below threshold",
                )
                self.last_recommendation_tick = tick

        if comms_health is not None and comms_health < 0.5 and tick - self.last_comms_action_tick > 120:
            ctx.schedule_action(
                action="restore_comms_relay",
                target="blue_relay_1",
                at_tick=tick + 60,
            )
            self.last_comms_action_tick = tick
