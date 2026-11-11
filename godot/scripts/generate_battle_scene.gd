extends SceneTree

const OUTPUT_DIR := "output_dir"


func _initialize() -> void:
	var input_path := _argument_value("--input")
	if input_path.is_empty() or not FileAccess.file_exists(input_path):
		push_error("A readable --input JSON file is required.")
		quit(2)
		return

	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(input_path))
	if not parsed is Dictionary:
		push_error("The input file must contain a JSON object.")
		quit(2)
		return

	var job_id := str(parsed.get("job_id", ""))
	var prompt := str(parsed.get("prompt", "")).strip_edges()
	var output_dir := str(parsed.get(OUTPUT_DIR, ""))
	if not _is_valid_job_id(job_id) or prompt.is_empty() or output_dir.is_empty():
		push_error("The input JSON is missing a valid job_id, prompt, or output_dir.")
		quit(2)
		return

	var root := _build_battlefield(job_id, prompt)
	var directory_error := DirAccess.make_dir_recursive_absolute(output_dir)
	if directory_error != OK:
		push_error("Unable to create the generated scene directory.")
		quit(1)
		return

	var packed_scene := PackedScene.new()
	var pack_error := packed_scene.pack(root)
	if pack_error != OK:
		push_error("Unable to pack the generated battlefield scene.")
		quit(1)
		return

	var output_path := output_dir.path_join("battlefield.tscn")
	var save_error := ResourceSaver.save(packed_scene, output_path)
	if save_error != OK:
		push_error("Unable to save the generated battlefield scene.")
		quit(1)
		return

	print("Generated battlefield scene for job %s." % job_id)
	quit(0)


func _argument_value(name: String) -> String:
	var arguments := OS.get_cmdline_user_args()
	var index := arguments.find(name)
	if index >= 0 and index + 1 < arguments.size():
		return arguments[index + 1]
	return ""


func _is_valid_job_id(value: String) -> bool:
	if value.length() != 36:
		return false
	for character in value:
		if not (character.is_valid_hex_number() or character == "-"):
			return false
	return true


func _build_battlefield(job_id: String, prompt: String) -> Node3D:
	var battlefield := Node3D.new()
	battlefield.name = "Battlefield"
	battlefield.set_meta("generation_job_id", job_id)
	battlefield.set_meta("scene_description", prompt)

	var environment_node := WorldEnvironment.new()
	environment_node.name = "BattlefieldEnvironment"
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.035, 0.048, 0.075)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.42, 0.48, 0.62)
	environment.ambient_light_energy = 0.62
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment_node.environment = environment
	battlefield.add_child(environment_node)
	environment_node.owner = battlefield

	_add_directional_light(battlefield)
	_add_camera(battlefield)
	_add_ground(battlefield)
	_add_battlefield_props(battlefield)
	_add_warrior(battlefield, "BlueWarrior", Vector3(-2.2, 0, 0.7), false)
	_add_warrior(battlefield, "OrangeWarrior", Vector3(2.2, 0, 0.7), true)
	return battlefield


func _add_directional_light(parent: Node3D) -> void:
	var light := DirectionalLight3D.new()
	light.name = "BattlefieldSun"
	light.rotation_degrees = Vector3(-47, -28, 0)
	light.light_color = Color(1.0, 0.87, 0.72)
	light.light_energy = 1.35
	light.shadow_enabled = true
	parent.add_child(light)
	light.owner = parent


func _add_camera(parent: Node3D) -> void:
	var camera := Camera3D.new()
	camera.name = "BattleCamera"
	camera.position = Vector3(0, 6.8, 13.8)
	camera.fov = 42.0
	camera.look_at(Vector3(0, 1.15, 0), Vector3.UP)
	camera.current = true
	parent.add_child(camera)
	camera.owner = parent


func _add_ground(parent: Node3D) -> void:
	var ground_material := _material(Color(0.14, 0.16, 0.19), false, 0.1)
	var path_material := _material(Color(0.22, 0.23, 0.24), false, 0.15)
	var stone_materials := [
		_material(Color(0.28, 0.29, 0.3), false, 0.18),
		_material(Color(0.23, 0.25, 0.27), false, 0.2),
		_material(Color(0.32, 0.3, 0.27), false, 0.16),
	]
	var crack_material := _material(Color(0.075, 0.082, 0.09), false, 0.0)

	_add_box(parent, "BattlefieldGround", ground_material, Vector3(0, -0.3, 0), Vector3(20, 0.6, 16))
	_add_box(parent, "DuelStonePath", path_material, Vector3(0, 0.012, 0.6), Vector3(8.7, 0.08, 5.6))

	var slabs := [
		[Vector3(-3.9, 0.08, 2.8), Vector3(1.8, 0.12, 1.2), 8.0],
		[Vector3(-1.9, 0.08, 3.2), Vector3(1.4, 0.12, 1.0), -6.0],
		[Vector3(0.1, 0.08, 2.9), Vector3(1.7, 0.12, 1.3), 4.0],
		[Vector3(2.1, 0.08, 3.25), Vector3(1.5, 0.12, 1.1), -9.0],
		[Vector3(3.9, 0.08, 2.65), Vector3(1.8, 0.12, 1.25), 6.0],
		[Vector3(-4.3, 0.08, -1.6), Vector3(1.1, 0.12, 1.4), -12.0],
		[Vector3(4.2, 0.08, -1.9), Vector3(1.4, 0.12, 1.0), 11.0],
		[Vector3(-6.3, 0.02, 3.4), Vector3(1.2, 0.1, 0.75), 22.0],
		[Vector3(6.5, 0.02, 2.8), Vector3(1.3, 0.1, 0.8), -18.0],
	]
	for index in slabs.size():
		var slab: Array = slabs[index]
		_add_box(
			parent,
			"BrokenPaving%d" % index,
			stone_materials[index % stone_materials.size()],
			slab[0],
			slab[1],
			Vector3(0, slab[2], 0)
		)

	var crack_lines := [
		[Vector3(-1.3, 0.06, 0.2), Vector3(2.0, 0.018, 0.045), -18.0],
		[Vector3(1.45, 0.06, 0.5), Vector3(1.55, 0.018, 0.04), 24.0],
		[Vector3(-2.65, 0.06, 1.1), Vector3(1.2, 0.018, 0.04), 38.0],
		[Vector3(0.35, 0.06, -1.1), Vector3(1.55, 0.018, 0.045), -32.0],
	]
	for index in crack_lines.size():
		var crack: Array = crack_lines[index]
		_add_box(
			parent,
			"StoneCrack%d" % index,
			crack_material,
			crack[0],
			crack[1],
			Vector3(0, crack[2], 0)
		)


func _add_battlefield_props(parent: Node3D) -> void:
	var stone := _material(Color(0.28, 0.29, 0.31), false, 0.2)
	var stone_light := _material(Color(0.37, 0.36, 0.33), false, 0.22)
	var rubble := _material(Color(0.2, 0.21, 0.22), false, 0.12)
	var metal := _material(Color(0.12, 0.14, 0.17), false, 0.62)

	_add_broken_pillar(parent, "LeftBrokenPillar", Vector3(-5.3, 0, -3.1), stone)
	_add_broken_pillar(parent, "RightBrokenPillar", Vector3(5.3, 0, -3.5), stone_light)

	_add_box(
		parent,
		"RuinedLintel",
		stone,
		Vector3(0, 3.0, -3.7),
		Vector3(6.4, 0.42, 0.48),
		Vector3(0, 0, -2.0)
	)
	_add_box(
		parent,
		"FallenWallSection",
		stone_light,
		Vector3(-1.45, 0.53, -2.9),
		Vector3(2.7, 0.86, 0.58),
		Vector3(0, -8.0, 8.0)
	)
	_add_box(
		parent,
		"BrokenWallCap",
		stone,
		Vector3(2.05, 0.46, -3.0),
		Vector3(1.9, 0.34, 0.72),
		Vector3(0, 12.0, -5.0)
	)

	var debris := [
		[Vector3(-4.4, 0.2, 1.25), Vector3(0.68, 0.3, 0.42), Vector3(12, 24, 15)],
		[Vector3(-3.5, 0.16, -1.35), Vector3(0.5, 0.24, 0.38), Vector3(18, -12, 28)],
		[Vector3(4.55, 0.18, 1.45), Vector3(0.72, 0.28, 0.46), Vector3(-8, 19, -22)],
		[Vector3(3.65, 0.15, -1.1), Vector3(0.46, 0.22, 0.38), Vector3(24, 32, 12)],
		[Vector3(-6.4, 0.18, -0.35), Vector3(0.58, 0.25, 0.48), Vector3(14, -24, 9)],
		[Vector3(6.3, 0.18, 0.1), Vector3(0.66, 0.27, 0.4), Vector3(-16, 21, 18)],
		[Vector3(-2.3, 0.15, -3.1), Vector3(0.64, 0.2, 0.38), Vector3(20, 0, 13)],
		[Vector3(2.7, 0.16, -2.65), Vector3(0.56, 0.22, 0.44), Vector3(-15, 18, -20)],
	]
	for index in debris.size():
		var item: Array = debris[index]
		_add_box(parent, "RubbleChunk%d" % index, rubble if index % 2 == 0 else stone, item[0], item[1], item[2])

	var rock_material := _material(Color(0.25, 0.27, 0.29), false, 0.12)
	var rock_positions := [
		Vector3(-7.6, 0.28, -1.8),
		Vector3(-7.0, 0.34, 4.1),
		Vector3(7.5, 0.31, -1.65),
		Vector3(6.8, 0.27, 4.3),
	]
	for index in rock_positions.size():
		var rock_mesh := SphereMesh.new()
		rock_mesh.radial_segments = 7
		rock_mesh.rings = 4
		var rock := _mesh_instance("FieldRock%d" % index, rock_mesh, rock_material)
		rock.position = rock_positions[index]
		rock.scale = Vector3(0.72 + float(index % 2) * 0.24, 0.45 + float(index % 2) * 0.12, 0.58)
		rock.rotation_degrees = Vector3(0, float(index * 31), float(index * 7 - 12))
		parent.add_child(rock)
		rock.owner = parent

	_add_box(
		parent,
		"BuriedBlade",
		metal,
		Vector3(-6.15, 0.21, 1.9),
		Vector3(0.08, 0.72, 0.08),
		Vector3(0, 0, 62)
	)
	_add_box(
		parent,
		"BrokenBannerPole",
		metal,
		Vector3(6.2, 0.56, -0.25),
		Vector3(0.08, 1.15, 0.08),
		Vector3(0, 0, -18)
	)
	_add_box(
		parent,
		"FadedBanner",
		_material(Color(0.38, 0.12, 0.09), false, 0.05),
		Vector3(6.38, 1.12, -0.25),
		Vector3(0.54, 0.68, 0.08),
		Vector3(0, 0, -12)
	)


func _add_broken_pillar(parent: Node3D, pillar_name: String, origin: Vector3, stone: Material) -> void:
	var pillar := Node3D.new()
	pillar.name = pillar_name
	pillar.position = origin
	parent.add_child(pillar)
	pillar.owner = parent

	var base := CylinderMesh.new()
	base.top_radius = 0.43
	base.bottom_radius = 0.54
	base.height = 0.38
	base.radial_segments = 7
	_add_piece(pillar, "PillarBase", base, stone, Vector3(0, 0.19, 0), Vector3.ONE)

	var shaft := CylinderMesh.new()
	shaft.top_radius = 0.34
	shaft.bottom_radius = 0.43
	shaft.height = 1.28
	shaft.radial_segments = 7
	_add_piece(pillar, "PillarShaft", shaft, stone, Vector3(0, 0.94, 0), Vector3.ONE)

	var broken_top := CylinderMesh.new()
	broken_top.top_radius = 0.2
	broken_top.bottom_radius = 0.34
	broken_top.height = 0.55
	broken_top.radial_segments = 6
	_add_piece(
		pillar,
		"JaggedPillarTop",
		broken_top,
		stone,
		Vector3(0.13, 1.77, -0.03),
		Vector3.ONE,
		Vector3(0, 0, 7)
	)

	_add_box(
		pillar,
		"PillarFallenCap",
		stone,
		Vector3(0.55, 1.54, 0.22),
		Vector3(0.86, 0.26, 0.42),
		Vector3(0, 0, -17)
	)


func _add_warrior(parent: Node3D, warrior_name: String, origin: Vector3, use_axe: bool) -> void:
	var warrior := Node3D.new()
	warrior.name = warrior_name
	warrior.position = origin
	warrior.rotation_degrees.y = 7.0 if use_axe else -7.0
	parent.add_child(warrior)
	warrior.owner = parent

	var armor := _material(Color(0.055, 0.13, 0.31) if not use_axe else Color(0.34, 0.095, 0.035), false, 0.38)
	var plate := _material(Color(0.12, 0.31, 0.68) if not use_axe else Color(0.75, 0.23, 0.055), false, 0.48)
	var highlight := _material(Color(0.38, 0.68, 0.9) if not use_axe else Color(1.0, 0.53, 0.16), false, 0.6)
	var cloth := _material(Color(0.035, 0.065, 0.12) if not use_axe else Color(0.16, 0.045, 0.02), false, 0.05)
	var leather := _material(Color(0.18, 0.12, 0.085), false, 0.16)
	var skin := _material(Color(0.68, 0.47, 0.35), false, 0.05)
	var dark := _material(Color(0.055, 0.065, 0.078), false, 0.22)
	var eye_material := _material(Color(0.025, 0.03, 0.04), false, 0.02)
	var weapon_glow := _material(Color(0.05, 0.34, 1.0) if not use_axe else Color(1.0, 0.22, 0.025), true)
	var sphere := SphereMesh.new()
	sphere.radial_segments = 8
	sphere.rings = 4
	var capsule := CapsuleMesh.new()
	capsule.radial_segments = 7
	capsule.rings = 2

	_add_piece(warrior, "ClothTabard", BoxMesh.new(), cloth, Vector3(0, 1.04, -0.03), Vector3(0.48, 0.58, 0.32))
	_add_piece(warrior, "Torso", BoxMesh.new(), armor, Vector3(0, 1.48, 0), Vector3(0.7, 0.76, 0.42))
	_add_piece(warrior, "ChestArmor", BoxMesh.new(), plate, Vector3(0, 1.55, 0.23), Vector3(0.62, 0.48, 0.12))
	_add_piece(warrior, "ChestInset", BoxMesh.new(), armor, Vector3(0, 1.54, 0.3), Vector3(0.32, 0.27, 0.045))
	_add_piece(warrior, "Belt", BoxMesh.new(), leather, Vector3(0, 1.07, 0.025), Vector3(0.7, 0.14, 0.45))
	_add_piece(warrior, "BeltBuckle", BoxMesh.new(), highlight, Vector3(0, 1.07, 0.26), Vector3(0.12, 0.12, 0.055))
	_add_piece(warrior, "FrontArmorSkirt", BoxMesh.new(), plate, Vector3(0, 0.87, 0.22), Vector3(0.52, 0.34, 0.12))

	for side in [-1.0, 1.0]:
		var side_name := "Left" if side < 0 else "Right"
		_add_piece(warrior, side_name + "Shoulder", sphere, plate, Vector3(side * 0.48, 1.78, 0), Vector3(0.32, 0.27, 0.3))
		_add_piece(
			warrior,
			side_name + "UpperArm",
			capsule,
			armor,
			Vector3(side * 0.62, 1.48, 0),
			Vector3(0.18, 0.3, 0.18),
			Vector3(0, 0, -side * 12.0)
		)
		_add_piece(
			warrior,
			side_name + "Forearm",
			capsule,
			plate,
			Vector3(side * 0.72, 1.16, 0.04),
			Vector3(0.16, 0.29, 0.17),
			Vector3(0, 0, side * 8.0)
		)
		_add_piece(
			warrior,
			side_name + "Gauntlet",
			BoxMesh.new(),
			highlight,
			Vector3(side * 0.73, 1.16, 0.19),
			Vector3(0.2, 0.24, 0.08),
			Vector3(0, 0, side * 8.0)
		)
		_add_piece(warrior, side_name + "Hand", sphere, leather, Vector3(side * 0.74, 0.91, 0.07), Vector3(0.13, 0.14, 0.13))

		_add_piece(warrior, side_name + "Thigh", capsule, cloth, Vector3(side * 0.22, 0.69, 0), Vector3(0.19, 0.31, 0.19))
		_add_piece(warrior, side_name + "KneeGuard", BoxMesh.new(), plate, Vector3(side * 0.22, 0.45, 0.13), Vector3(0.28, 0.21, 0.11))
		_add_piece(warrior, side_name + "Greave", BoxMesh.new(), armor, Vector3(side * 0.22, 0.27, 0.02), Vector3(0.26, 0.34, 0.28))
		_add_piece(warrior, side_name + "Boot", BoxMesh.new(), dark, Vector3(side * 0.22, 0.09, 0.12), Vector3(0.33, 0.17, 0.46))
		_add_piece(warrior, side_name + "GreaveTrim", BoxMesh.new(), highlight, Vector3(side * 0.22, 0.37, 0.17), Vector3(0.27, 0.055, 0.055))

	_add_piece(warrior, "Neck", capsule, skin, Vector3(0, 2.0, 0), Vector3(0.15, 0.17, 0.15))
	_add_piece(warrior, "Head", sphere, skin, Vector3(0, 2.28, 0.015), Vector3(0.29, 0.32, 0.27))
	_add_piece(warrior, "HelmetCap", sphere, plate, Vector3(0, 2.51, -0.015), Vector3(0.33, 0.2, 0.3))
	_add_piece(warrior, "HelmetRim", BoxMesh.new(), highlight, Vector3(0, 2.39, 0.1), Vector3(0.58, 0.095, 0.32))
	_add_piece(warrior, "HelmetNoseGuard", BoxMesh.new(), armor, Vector3(0, 2.26, 0.27), Vector3(0.1, 0.28, 0.07))
	_add_piece(warrior, "HelmetCrest", BoxMesh.new(), highlight, Vector3(0, 2.69, -0.015), Vector3(0.1, 0.27, 0.12), Vector3(0, 0, 8))
	_add_piece(warrior, "LeftEye", sphere, eye_material, Vector3(-0.09, 2.31, 0.249), Vector3(0.045, 0.035, 0.025))
	_add_piece(warrior, "RightEye", sphere, eye_material, Vector3(0.09, 2.31, 0.249), Vector3(0.045, 0.035, 0.025))

	if use_axe:
		_add_battle_axe(warrior, weapon_glow, dark, highlight, -1.0)
		_add_weapon_light(warrior, Color(1.0, 0.22, 0.035), Vector3(-0.9, 2.0, 0.28))
	else:
		_add_energy_sword(warrior, weapon_glow, dark, highlight, 1.0)
		_add_weapon_light(warrior, Color(0.12, 0.38, 1.0), Vector3(0.9, 2.05, 0.28))


func _add_energy_sword(parent: Node3D, glow: Material, grip: Material, guard: Material, side: float) -> void:
	var x := side * 0.82
	_add_piece(parent, "SwordGrip", CylinderMesh.new(), grip, Vector3(x, 1.02, 0.27), Vector3(0.07, 0.15, 0.07))
	_add_piece(parent, "SwordPommel", SphereMesh.new(), guard, Vector3(x, 0.88, 0.27), Vector3(0.09, 0.08, 0.09))
	_add_piece(parent, "SwordGuard", BoxMesh.new(), guard, Vector3(x, 1.19, 0.27), Vector3(0.48, 0.085, 0.12))
	_add_piece(parent, "SwordBladeCore", BoxMesh.new(), glow, Vector3(x, 1.78, 0.27), Vector3(0.15, 1.08, 0.07))

	var blade_tip := CylinderMesh.new()
	blade_tip.top_radius = 0.0
	blade_tip.bottom_radius = 0.105
	blade_tip.height = 0.28
	blade_tip.radial_segments = 4
	_add_piece(parent, "SwordPoint", blade_tip, glow, Vector3(x, 2.46, 0.27), Vector3.ONE)
	_add_piece(parent, "SwordFuller", BoxMesh.new(), guard, Vector3(x, 1.78, 0.312), Vector3(0.035, 0.74, 0.012))


func _add_battle_axe(parent: Node3D, glow: Material, grip: Material, guard: Material, side: float) -> void:
	var x := side * 0.82
	_add_piece(parent, "AxeHandle", CylinderMesh.new(), grip, Vector3(x, 1.48, 0.25), Vector3(0.075, 0.72, 0.075))
	_add_piece(parent, "AxeGripWrap", BoxMesh.new(), guard, Vector3(x, 1.07, 0.28), Vector3(0.17, 0.28, 0.12))
	_add_piece(parent, "AxeSocket", BoxMesh.new(), guard, Vector3(x, 2.12, 0.25), Vector3(0.2, 0.3, 0.2))

	var points := PackedVector2Array([
		Vector2(0, -0.17),
		Vector2(0.2, -0.23),
		Vector2(0.52, -0.39),
		Vector2(0.39, -0.02),
		Vector2(0.52, 0.36),
		Vector2(0.2, 0.23),
		Vector2(0, 0.17),
	])
	if side < 0:
		var mirrored := PackedVector2Array()
		for index in range(points.size() - 1, -1, -1):
			mirrored.append(Vector2(-points[index].x, points[index].y))
		points = mirrored

	var axe_head := _polygon_prism_mesh(points, 0.16)
	var head_instance := _mesh_instance("AxeBlade", axe_head, glow)
	head_instance.position = Vector3(x, 2.12, 0.25)
	parent.add_child(head_instance)
	head_instance.owner = parent.owner


func _add_weapon_light(parent: Node3D, color: Color, location: Vector3) -> void:
	var light := OmniLight3D.new()
	light.name = "WeaponGlow"
	light.position = location
	light.light_color = color
	light.light_energy = 0.8
	light.omni_range = 3.0
	light.shadow_enabled = false
	parent.add_child(light)
	light.owner = parent.owner


func _polygon_prism_mesh(points: PackedVector2Array, depth: float) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var triangles := Geometry2D.triangulate_polygon(points)
	if triangles.is_empty():
		return ArrayMesh.new()

	var front_z := depth * 0.5
	var back_z := -front_z
	for index in range(0, triangles.size(), 3):
		var a: Vector2 = points[triangles[index]]
		var b: Vector2 = points[triangles[index + 1]]
		var c: Vector2 = points[triangles[index + 2]]
		surface.add_vertex(Vector3(a.x, a.y, front_z))
		surface.add_vertex(Vector3(b.x, b.y, front_z))
		surface.add_vertex(Vector3(c.x, c.y, front_z))
		surface.add_vertex(Vector3(c.x, c.y, back_z))
		surface.add_vertex(Vector3(b.x, b.y, back_z))
		surface.add_vertex(Vector3(a.x, a.y, back_z))

	for index in points.size():
		var next := (index + 1) % points.size()
		var a := points[index]
		var b := points[next]
		surface.add_vertex(Vector3(a.x, a.y, front_z))
		surface.add_vertex(Vector3(b.x, b.y, front_z))
		surface.add_vertex(Vector3(b.x, b.y, back_z))
		surface.add_vertex(Vector3(a.x, a.y, front_z))
		surface.add_vertex(Vector3(b.x, b.y, back_z))
		surface.add_vertex(Vector3(a.x, a.y, back_z))

	surface.generate_normals()
	return surface.commit()


func _add_box(
	parent: Node3D,
	piece_name: String,
	surface_material: Material,
	location: Vector3,
	piece_scale: Vector3,
	rotation_degrees: Vector3 = Vector3.ZERO
) -> MeshInstance3D:
	return _add_piece(parent, piece_name, BoxMesh.new(), surface_material, location, piece_scale, rotation_degrees)


func _add_piece(
	parent: Node3D,
	piece_name: String,
	mesh: Mesh,
	surface_material: Material,
	location: Vector3,
	piece_scale: Vector3,
	rotation_degrees: Vector3 = Vector3.ZERO
) -> MeshInstance3D:
	var piece := _mesh_instance(piece_name, mesh, surface_material)
	piece.position = location
	piece.scale = piece_scale
	piece.rotation_degrees = rotation_degrees
	parent.add_child(piece)
	piece.owner = parent.owner
	return piece


func _mesh_instance(instance_name: String, mesh: Mesh, surface_material: Material) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = instance_name
	instance.mesh = mesh
	instance.material_override = surface_material
	return instance


func _material(color: Color, emissive: bool = false, metallic: float = 0.0) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.72
	material.metallic = metallic
	if emissive:
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = 1.25
	return material
