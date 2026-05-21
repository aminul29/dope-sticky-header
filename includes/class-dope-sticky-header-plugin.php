<?php
/**
 * Plugin bootstrap and Elementor integration.
 *
 * @package DopeStickyHeader
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Elementor\Controls_Manager;
use Elementor\Element_Base;

/**
 * Core plugin class.
 */
final class Dope_Sticky_Header_Plugin {
	const MINIMUM_ELEMENTOR_VERSION = '3.20.0';
	const MINIMUM_PHP_VERSION       = '7.4';

	/**
	 * Singleton holder.
	 *
	 * @var self|null
	 */
	private static $instance = null;

	/**
	 * Whether frontend assets were enqueued on this request.
	 *
	 * @var bool
	 */
	private $assets_enqueued = false;

	/**
	 * Get singleton instance.
	 *
	 * @return self
	 */
	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		add_action( 'plugins_loaded', array( $this, 'init' ) );
	}

	/**
	 * Initialize plugin hooks.
	 *
	 * @return void
	 */
	public function init(): void {
		if ( ! did_action( 'elementor/loaded' ) ) {
			add_action( 'admin_notices', array( $this, 'admin_notice_missing_elementor' ) );
			return;
		}

		if ( version_compare( ELEMENTOR_VERSION, self::MINIMUM_ELEMENTOR_VERSION, '<' ) ) {
			add_action( 'admin_notices', array( $this, 'admin_notice_minimum_elementor_version' ) );
			return;
		}

		if ( version_compare( PHP_VERSION, self::MINIMUM_PHP_VERSION, '<' ) ) {
			add_action( 'admin_notices', array( $this, 'admin_notice_minimum_php_version' ) );
			return;
		}

		add_action( 'wp_enqueue_scripts', array( $this, 'register_assets' ) );
		add_action( 'elementor/preview/enqueue_scripts', array( $this, 'register_assets' ) );
		add_action( 'elementor/preview/enqueue_styles', array( $this, 'register_assets' ) );

		add_action( 'elementor/element/container/section_layout/after_section_end', array( $this, 'inject_controls' ), 10, 2 );
		add_action( 'elementor/frontend/container/before_render', array( $this, 'before_container_render' ) );
	}

	/**
	 * Register styles/scripts once; enqueue later when needed.
	 *
	 * @return void
	 */
	public function register_assets(): void {
		wp_register_style(
			'dope-sticky-header',
			DOPE_STICKY_HEADER_URL . 'assets/css/dope-sticky-header.css',
			array(),
			DOPE_STICKY_HEADER_VERSION
		);

		wp_register_script(
			'dope-sticky-header',
			DOPE_STICKY_HEADER_URL . 'assets/js/dope-sticky-header.js',
			array(),
			DOPE_STICKY_HEADER_VERSION,
			true
		);
	}

	/**
	 * Inject sticky controls into Container Advanced tab area.
	 *
	 * @param \Elementor\Controls_Stack $element Elementor controls stack.
	 * @param array                     $args    Section args.
	 * @return void
	 */
	public function inject_controls( $element, array $args ): void {
		unset( $args );

		$element->start_injection(
			array(
				'of' => 'css_classes',
			)
		);

		$element->add_control(
			'dsh_sticky_heading',
			array(
				'label'     => esc_html__( 'Dope Sticky Header', 'dope-sticky-header' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
			)
		);

		$element->add_control(
			'dsh_enable_sticky',
			array(
				'label'            => esc_html__( 'Enable Sticky Header', 'dope-sticky-header' ),
				'type'             => Controls_Manager::SWITCHER,
				'label_on'         => esc_html__( 'Yes', 'dope-sticky-header' ),
				'label_off'        => esc_html__( 'No', 'dope-sticky-header' ),
				'return_value'     => 'yes',
				'default'          => '',
				'frontend_available' => true,
				'render_type'      => 'none',
			)
		);

		$element->add_control(
			'dsh_scroll_reveal_type',
			array(
				'label'   => esc_html__( 'Reveal Behavior', 'dope-sticky-header' ),
				'type'    => Controls_Manager::SELECT,
				'options' => array(
					'standard'      => esc_html__( 'Standard Sticky', 'dope-sticky-header' ),
					'direction'     => esc_html__( 'Slide In on Scroll Up (CSS)', 'dope-sticky-header' ),
					'scroll_linked' => esc_html__( 'Interactive Scroll-Linked (JS)', 'dope-sticky-header' ),
				),
				'default' => 'standard',
				'condition' => array(
					'dsh_enable_sticky' => 'yes',
				),
				'frontend_available' => true,
				'render_type'      => 'none',
			)
		);

		// Retained for backwards-compatibility with saved pages
		$element->add_control(
			'dsh_direction_aware',
			array(
				'label'            => esc_html__( 'Direction-Aware [Deprecated]', 'dope-sticky-header' ),
				'type'             => Controls_Manager::SWITCHER,
				'label_on'         => esc_html__( 'Yes', 'dope-sticky-header' ),
				'label_off'        => esc_html__( 'No', 'dope-sticky-header' ),
				'return_value'     => 'yes',
				'default'          => '',
				'condition'        => array(
					'dsh_enable_sticky' => 'yes',
					'dsh_scroll_reveal_type' => 'standard', // Only show if standard to avoid UI clutter
				),
				'frontend_available' => true,
				'render_type'      => 'none',
			)
		);

		$element->add_control(
			'dsh_sticky_devices',
			array(
				'label'              => esc_html__( 'Sticky Devices', 'dope-sticky-header' ),
				'type'               => Controls_Manager::SELECT2,
				'options'            => array(
					'desktop' => esc_html__( 'Desktop', 'dope-sticky-header' ),
					'tablet'  => esc_html__( 'Tablet', 'dope-sticky-header' ),
					'mobile'  => esc_html__( 'Mobile', 'dope-sticky-header' ),
				),
				'default'            => array( 'desktop', 'tablet', 'mobile' ),
				'multiple'           => true,
				'label_block'        => true,
				'condition'          => array(
					'dsh_enable_sticky' => 'yes',
				),
				'frontend_available' => true,
				'render_type'        => 'none',
			)
		);

		$element->add_control(
			'dsh_sticky_delay',
			array(
				'label'              => esc_html__( 'Sticky Delay (px)', 'dope-sticky-header' ),
				'type'               => Controls_Manager::NUMBER,
				'default'            => 0,
				'min'                => 0,
				'step'               => 1,
				'condition'          => array(
					'dsh_enable_sticky' => 'yes',
				),
				'frontend_available' => true,
				'render_type'        => 'none',
			)
		);

		$element->add_control(
			'dsh_sticky_down_animation',
			array(
				'label'              => esc_html__( 'Scroll Down Animation', 'dope-sticky-header' ),
				'type'               => Controls_Manager::SELECT,
				'options'            => array(
					'fade_in_down' => esc_html__( 'Fade In Down', 'dope-sticky-header' ),
					'none'         => esc_html__( 'None', 'dope-sticky-header' ),
				),
				'default'            => 'fade_in_down',
				'condition'          => array(
					'dsh_enable_sticky' => 'yes',
				),
				'frontend_available' => true,
				'render_type'        => 'none',
			)
		);

		$element->add_control(
			'dsh_sticky_anim_duration',
			array(
				'label'              => esc_html__( 'Animation Duration (ms)', 'dope-sticky-header' ),
				'type'               => Controls_Manager::NUMBER,
				'default'            => 260,
				'min'                => 0,
				'step'               => 10,
				'condition'          => array(
					'dsh_enable_sticky' => 'yes',
				),
				'frontend_available' => true,
				'render_type'        => 'none',
			)
		);

		$element->add_control(
			'dsh_sticky_anim_easing',
			array(
				'label'              => esc_html__( 'Animation Easing', 'dope-sticky-header' ),
				'type'               => Controls_Manager::SELECT,
				'options'            => array(
					'ease'                           => esc_html__( 'Ease', 'dope-sticky-header' ),
					'ease-in'                        => esc_html__( 'Ease In', 'dope-sticky-header' ),
					'ease-out'                       => esc_html__( 'Ease Out', 'dope-sticky-header' ),
					'ease-in-out'                    => esc_html__( 'Ease In Out', 'dope-sticky-header' ),
					'cubic-bezier(0.22,1,0.36,1)'   => esc_html__( 'Smooth (Cubic)', 'dope-sticky-header' ),
				),
				'default'            => 'cubic-bezier(0.22,1,0.36,1)',
				'condition'          => array(
					'dsh_enable_sticky' => 'yes',
				),
				'frontend_available' => true,
				'render_type'        => 'none',
			)
		);

		$element->add_control(
			'dsh_native_sticky_warning',
			array(
				'type'            => Controls_Manager::RAW_HTML,
				'content_classes' => 'elementor-control-field-description',
				'raw'             => esc_html__( 'Dope Sticky Header overrides Elementor native Sticky for this container. Set Elementor Sticky to "None" for the cleanest setup.', 'dope-sticky-header' ),
				'condition'       => array(
					'dsh_enable_sticky' => 'yes',
					'sticky!'           => '',
				),
			)
		);

		$element->end_injection();
	}

	/**
	 * Add runtime attributes and neutralize native sticky on opted-in containers.
	 *
	 * @param Element_Base $element Elementor element instance.
	 * @return void
	 */
	public function before_container_render( Element_Base $element ): void {
		$enabled = $element->get_settings_for_display( 'dsh_enable_sticky' );
		if ( 'yes' !== $enabled ) {
			return;
		}

		$devices = $element->get_settings_for_display( 'dsh_sticky_devices' );
		if ( ! is_array( $devices ) || empty( $devices ) ) {
			$devices = array( 'desktop', 'tablet', 'mobile' );
		}

		$delay = $element->get_settings_for_display( 'dsh_sticky_delay' );
		$delay = is_numeric( $delay ) ? max( 0, (int) $delay ) : 0;

		$animation = (string) $element->get_settings_for_display( 'dsh_sticky_down_animation' );
		if ( '' === $animation ) {
			$animation = 'fade_in_down';
		}

		$duration = $element->get_settings_for_display( 'dsh_sticky_anim_duration' );
		$duration = is_numeric( $duration ) ? max( 0, (int) $duration ) : 260;

		$easing = (string) $element->get_settings_for_display( 'dsh_sticky_anim_easing' );
		if ( '' === $easing ) {
			$easing = 'cubic-bezier(0.22,1,0.36,1)';
		}

		$reveal_type = (string) $element->get_settings_for_display( 'dsh_scroll_reveal_type' );
		$direction_aware = $element->get_settings_for_display( 'dsh_direction_aware' );
		if ( empty( $reveal_type ) || 'standard' === $reveal_type ) {
			if ( 'yes' === $direction_aware ) {
				$reveal_type = 'direction';
			} else {
				$reveal_type = 'standard';
			}
		}

		$native_sticky = $element->get_settings( 'sticky' );
		if ( ! empty( $native_sticky ) ) {
			$element->set_settings( 'sticky', '' );
			$element->set_settings( 'sticky_on', array() );
			$element->set_settings( 'sticky_offset', 0 );
			$element->set_settings( 'sticky_effects_offset', 0 );
			$element->set_settings( 'sticky_anchor_link_offset', 0 );
		}

		$element->add_render_attribute( '_wrapper', 'class', 'dsh-sticky-target' );
		$element->add_render_attribute( '_wrapper', 'data-dsh-enabled', 'yes' );
		$element->add_render_attribute( '_wrapper', 'data-dsh-delay', (string) $delay );
		$element->add_render_attribute( '_wrapper', 'data-dsh-down-animation', $animation );
		$element->add_render_attribute( '_wrapper', 'data-dsh-duration', (string) $duration );
		$element->add_render_attribute( '_wrapper', 'data-dsh-easing', $easing );
		$element->add_render_attribute( '_wrapper', 'data-dsh-devices', implode( ',', array_map( 'sanitize_key', $devices ) ) );
		$element->add_render_attribute( '_wrapper', 'data-dsh-had-native', ! empty( $native_sticky ) ? 'yes' : 'no' );
		$element->add_render_attribute( '_wrapper', 'data-dsh-direction-aware', 'direction' === $reveal_type ? 'yes' : 'no' );
		$element->add_render_attribute( '_wrapper', 'data-dsh-reveal-type', $reveal_type );

		$this->enqueue_assets_once();
	}

	/**
	 * Enqueue assets only when at least one sticky container is rendered.
	 *
	 * @return void
	 */
	private function enqueue_assets_once(): void {
		if ( $this->assets_enqueued ) {
			return;
		}

		$this->register_assets();
		wp_enqueue_style( 'dope-sticky-header' );
		wp_enqueue_script( 'dope-sticky-header' );
		$this->assets_enqueued = true;
	}

	/**
	 * Admin notice for missing Elementor.
	 *
	 * @return void
	 */
	public function admin_notice_missing_elementor(): void {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		echo '<div class="notice notice-warning is-dismissible"><p>';
		echo esc_html__( 'Dope Sticky Header requires Elementor to be installed and activated.', 'dope-sticky-header' );
		echo '</p></div>';
	}

	/**
	 * Admin notice for Elementor version mismatch.
	 *
	 * @return void
	 */
	public function admin_notice_minimum_elementor_version(): void {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		printf(
			'<div class="notice notice-warning is-dismissible"><p>%s</p></div>',
			esc_html(
				sprintf(
					/* translators: %s is required Elementor version. */
					__( 'Dope Sticky Header requires Elementor version %s or greater.', 'dope-sticky-header' ),
					self::MINIMUM_ELEMENTOR_VERSION
				)
			)
		);
	}

	/**
	 * Admin notice for minimum PHP version.
	 *
	 * @return void
	 */
	public function admin_notice_minimum_php_version(): void {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		printf(
			'<div class="notice notice-warning is-dismissible"><p>%s</p></div>',
			esc_html(
				sprintf(
					/* translators: %s is required PHP version. */
					__( 'Dope Sticky Header requires PHP version %s or greater.', 'dope-sticky-header' ),
					self::MINIMUM_PHP_VERSION
				)
			)
		);
	}
}
